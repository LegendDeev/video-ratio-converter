/**
 * ffmpegProcessor.js — fixed crop mode for landscape (16:9) sources.
 *
 * BLUR mode: no change — works correctly.
 * CROP mode fix: for landscape videos, scaling width=1080 gives height=607
 *   which is less than 1920 — crop then fails with "Invalid argument".
 *   Fix: scale so the HEIGHT covers 1920px first, then crop width to 1080.
 *   For a 1920×1080 source:
 *     scale to h=1920 → w=3413, then crop w=1080 from centre → 1080×1920 ✓
 */

const { spawn } = require('child_process');

const FFMPEG_BIN  = process.env.FFMPEG_PATH  || 'ffmpeg';
const FFPROBE_BIN = process.env.FFPROBE_PATH || 'ffprobe';

const TARGET_W = 1080;
const TARGET_H = 1920;

/* ── probeVideo ─────────────────────────────────────────────────────────── */
function probeVideo(inputPath) {
  return new Promise((resolve, reject) => {
    const args = [
      '-v', 'quiet',
      '-print_format', 'json',
      '-show_format',
      '-show_streams',
      inputPath,
    ];

    const proc = spawn(FFPROBE_BIN, args);
    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', d => (stdout += d));
    proc.stderr.on('data', d => (stderr += d));

    proc.on('close', code => {
      if (code !== 0)
        return reject(new Error(`ffprobe exited ${code}: ${stderr.slice(-400)}`));
      try {
        const json = JSON.parse(stdout);
        const vs = json.streams.find(s => s.codec_type === 'video');
        if (!vs) return reject(new Error('No video stream found'));
        resolve({
          width:    vs.width,
          height:   vs.height,
          duration: parseFloat(json.format.duration || 0),
          bitrate:  json.format.bit_rate,
        });
      } catch (e) {
        reject(new Error(`ffprobe parse error: ${e.message}`));
      }
    });

    proc.on('error', () =>
      reject(new Error(`Cannot find ffprobe at "${FFPROBE_BIN}". Set FFPROBE_PATH in backend/.env`))
    );
  });
}

/* ── convertVideo ───────────────────────────────────────────────────────── */
function convertVideo(inputPath, outputPath, mode = 'blur', onProgress) {
  return new Promise(async (resolve, reject) => {

    let totalSeconds = 0;
    try {
      const meta = await probeVideo(inputPath);
      totalSeconds = meta.duration || 0;
    } catch (_) {}

    let filterComplex;

    if (mode === 'blur') {
      /**
       * BLUR BACKGROUND MODE
       * ─────────────────────────────────────────────────────────────────
       * bg: scale to COVER 1080×1920 (may overflow) → crop exact → blur
       * fg: scale to FIT inside 1080×1920 (no crop)  → pad to exact size
       * composite: overlay fg centred on bg
       *
       * force_original_aspect_ratio=increase ensures bg always covers canvas.
       * force_original_aspect_ratio=decrease ensures fg never overflows.
       */
      filterComplex =
        `[0:v]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,` +
        `crop=${TARGET_W}:${TARGET_H},` +
        `boxblur=luma_radius=50:luma_power=2[bg];` +
        `[0:v]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,` +
        `pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:color=black@0[fg];` +
        `[bg][fg]overlay=0:0[out]`;

    } else {
      /**
       * CENTRE CROP MODE — FIXED for landscape (16:9) sources
       * ─────────────────────────────────────────────────────────────────
       * WRONG (old): scale=1080:-2 → for 1920×1080 source gives 1080×607
       *              crop=1080:1920 then fails — not enough height!
       *
       * CORRECT: use force_original_aspect_ratio=increase so the frame
       *          COVERS the 1080×1920 canvas before cropping.
       *          For a 1920×1080 source:
       *            scale to cover 1080×1920 → 3413×1920 (width overflows)
       *            crop 1080×1920 from centre → ✓
       *
       * This is identical to the bg path in blur mode, just without the blur.
       */
      filterComplex =
        `[0:v]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,` +
        `crop=${TARGET_W}:${TARGET_H}[out]`;
    }

    const args = [
      '-y',
      '-i', inputPath,
      '-filter_complex', filterComplex,
      '-map', '[out]',
      '-map', '0:a?',
      '-c:v', 'libx264',
      '-crf', '18',
      '-preset', 'medium',
      '-profile:v', 'high',
      '-pix_fmt', 'yuv420p',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      outputPath,
    ];

    console.log('[ffmpeg] Mode:', mode);
    console.log('[ffmpeg] Filter:', filterComplex);
    console.log('[ffmpeg] Output:', outputPath);

    const proc = spawn(FFMPEG_BIN, args);
    let stderrBuf = '';

    proc.stderr.on('data', chunk => {
      const text = chunk.toString();
      stderrBuf += text;

      if (totalSeconds > 0) {
        const m = text.match(/time=(\d+):(\d+):(\d+\.\d+)/);
        if (m) {
          const elapsed = parseInt(m[1]) * 3600 + parseInt(m[2]) * 60 + parseFloat(m[3]);
          const pct = Math.min(Math.round((elapsed / totalSeconds) * 100), 99);
          if (typeof onProgress === 'function') onProgress(pct);
        }
      }
    });

    proc.on('close', code => {
      if (code === 0) {
        console.log('[ffmpeg] Success:', outputPath);
        resolve(outputPath);
      } else {
        const tail = stderrBuf.slice(-800).trim();
        console.error(`[ffmpeg] Exit ${code}:\n${tail}`);
        reject(new Error(`FFmpeg error (exit ${code}): ${tail}`));
      }
    });

    proc.on('error', () =>
      reject(new Error(`Cannot start ffmpeg at "${FFMPEG_BIN}". Set FFMPEG_PATH in backend/.env`))
    );
  });
}

module.exports = { convertVideo, probeVideo };
