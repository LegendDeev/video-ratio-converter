/**
 * server.js – Express backend for the Video Converter app
 *
 * Endpoints:
 *   POST   /api/upload          – Upload a video file
 *   POST   /api/convert         – Trigger conversion (blur or crop)
 *   GET    /api/progress/:id    – SSE stream for conversion progress
 *   GET    /api/download/:id    – Download the converted file
 *   GET    /api/preview/:id     – Stream the original uploaded file for preview
 *   DELETE /api/cleanup         – Remove specific temp files
 *   DELETE /api/cleanup/all     – Remove ALL files in uploads + outputs
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { convertVideo, probeVideo } = require('./ffmpegProcessor');

const app = express();
const PORT = process.env.PORT || 5000;
const MAX_SIZE_MB = parseInt(process.env.MAX_FILE_SIZE_MB || '500', 10);

// ─── Directories ──────────────────────────────────────────────────────────────
const UPLOAD_DIR = path.join(__dirname, 'uploads');
const OUTPUT_DIR = path.join(__dirname, 'outputs');
[UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ─── Progress + SSE stores ────────────────────────────────────────────────────
const progressStore = {};
const sseClients = {};

function sendProgress(jobId, percent, done = false, error = null) {
  progressStore[jobId] = { percent, done, error };
  if (sseClients[jobId]) {
    const payload = JSON.stringify({ percent, done, error });
    sseClients[jobId].forEach(res => res.write(`data: ${payload}\n\n`));
    if (done || error) {
      sseClients[jobId].forEach(res => res.end());
      delete sseClients[jobId];
    }
  }
}

// ─── Middleware ───────────────────────────────────────────────────────────────
// Allow specific origin in production (set CORS_ORIGIN in .env)
// or fall back to allow all origins in development
const corsOrigin = process.env.CORS_ORIGIN || '*';
app.use(cors({
  origin: corsOrigin,
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));
app.use(express.json());

// ─── Multer ───────────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.mp4';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_MB * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /mp4|mov|avi|mkv|webm|m4v/;
    const ext = path.extname(file.originalname).toLowerCase().replace('.', '');
    if (allowed.test(ext)) return cb(null, true);
    cb(new Error('Only video files are allowed (mp4, mov, avi, mkv, webm, m4v)'));
  },
});

// ─── Routes ───────────────────────────────────────────────────────────────────

// POST /api/upload
app.post('/api/upload', upload.single('video'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file received.' });
  try {
    const meta = await probeVideo(req.file.path);
    return res.json({
      fileId: path.parse(req.file.filename).name,
      filename: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
      width: meta.width,
      height: meta.height,
      duration: parseFloat(meta.duration).toFixed(2),
    });
  } catch (err) {
    fs.unlink(req.file.path, () => {});
    return res.status(500).json({ error: `Could not read video metadata: ${err.message}` });
  }
});

// POST /api/convert
app.post('/api/convert', async (req, res) => {
  const { filename, mode = 'blur' } = req.body;
  if (!filename) return res.status(400).json({ error: 'filename is required.' });
  if (!['blur', 'black', 'crop'].includes(mode))
    return res.status(400).json({ error: "mode must be 'blur' or 'crop'." });

  const inputPath = path.join(UPLOAD_DIR, filename);
  if (!fs.existsSync(inputPath))
    return res.status(404).json({ error: 'Uploaded file not found. Please re-upload.' });

  const jobId = uuidv4();
  const outputFilename = `${jobId}_vertical.mp4`;
  const outputPath = path.join(OUTPUT_DIR, outputFilename);

  progressStore[jobId] = { percent: 0, done: false, error: null };
  res.json({ jobId, outputFilename });

  convertVideo(inputPath, outputPath, mode, (pct) => sendProgress(jobId, pct))
    .then(() => sendProgress(jobId, 100, true))
    .catch(err => sendProgress(jobId, 0, false, err.message));
});

// GET /api/progress/:jobId  (SSE)
app.get('/api/progress/:jobId', (req, res) => {
  const { jobId } = req.params;
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  const current = progressStore[jobId];
  if (current) {
    res.write(`data: ${JSON.stringify(current)}\n\n`);
    if (current.done || current.error) { res.end(); return; }
  }

  if (!sseClients[jobId]) sseClients[jobId] = [];
  sseClients[jobId].push(res);
  req.on('close', () => {
    if (sseClients[jobId]) {
      sseClients[jobId] = sseClients[jobId].filter(r => r !== res);
      if (!sseClients[jobId].length) delete sseClients[jobId];
    }
  });
});

// GET /api/preview/:filename
app.get('/api/preview/:filename', (req, res) => {
  const filePath = path.join(UPLOAD_DIR, path.basename(req.params.filename));
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found.' });
  res.sendFile(filePath);
});

// GET /api/download/:filename
app.get('/api/download/:filename', (req, res) => {
  const filePath = path.join(OUTPUT_DIR, path.basename(req.params.filename));
  console.log('[download] Requested:', filePath);
  console.log('[download] Exists:', fs.existsSync(filePath));
  if (!fs.existsSync(filePath)) {
    console.log('[download] Files in output dir:', fs.readdirSync(OUTPUT_DIR));
    return res.status(404).json({ error: 'Output file not found.' });
  }
  res.setHeader('Content-Disposition', `attachment; filename="vertical_video.mp4"`);
  res.setHeader('Content-Type', 'video/mp4');
  const stream = fs.createReadStream(filePath);
  stream.pipe(res);
  stream.on('error', err => {
    console.error('[download] Stream error:', err);
    res.status(500).end();
  });
});

// DELETE /api/cleanup  – remove specific files after download
app.delete('/api/cleanup', (req, res) => {
  const { uploadFilename, outputFilename } = req.body;
  const toDelete = [
    uploadFilename && path.join(UPLOAD_DIR, path.basename(uploadFilename)),
    outputFilename && path.join(OUTPUT_DIR, path.basename(outputFilename)),
  ].filter(Boolean);
  toDelete.forEach(f => { if (fs.existsSync(f)) fs.unlink(f, () => {}); });
  res.json({ ok: true });
});

// DELETE /api/cleanup/all  – wipe EVERYTHING in uploads + outputs
app.delete('/api/cleanup/all', (req, res) => {
  let deleted = 0;
  let errors = 0;

  [UPLOAD_DIR, OUTPUT_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) return;
    fs.readdirSync(dir).forEach(file => {
      // Safety: only delete known video/mp4 files, never delete .gitkeep etc.
      const ext = path.extname(file).toLowerCase();
      if (!['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(ext)) return;
      try {
        fs.unlinkSync(path.join(dir, file));
        deleted++;
      } catch (e) {
        errors++;
        console.error('[cleanup/all] Could not delete', file, e.message);
      }
    });
  });

  console.log(`[cleanup/all] Deleted ${deleted} file(s), ${errors} error(s)`);
  res.json({ ok: true, deleted, errors });
});

// GET /api/storage  – returns file counts + total size (for the admin panel)
app.get('/api/storage', (req, res) => {
  function dirStats(dir) {
    if (!fs.existsSync(dir)) return { count: 0, bytes: 0 };
    const files = fs.readdirSync(dir);
    const videoFiles = files.filter(f =>
      ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'].includes(path.extname(f).toLowerCase())
    );
    const bytes = videoFiles.reduce((sum, f) => {
      try { return sum + fs.statSync(path.join(dir, f)).size; } catch { return sum; }
    }, 0);
    return { count: videoFiles.length, bytes };
  }

  const uploads = dirStats(UPLOAD_DIR);
  const outputs = dirStats(OUTPUT_DIR);
  res.json({
    uploads,
    outputs,
    total: {
      count: uploads.count + outputs.count,
      bytes: uploads.bytes + outputs.bytes,
    },
  });
});

// ─── Multer error handler ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE')
    return res.status(413).json({ error: `File too large. Max is ${MAX_SIZE_MB} MB.` });
  if (err) return res.status(400).json({ error: err.message });
  next();
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
process.on('SIGINT', () => { console.log('\nShutting down...'); process.exit(0); });

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`✅ Video Converter backend running on http://localhost:${PORT}`);
});
