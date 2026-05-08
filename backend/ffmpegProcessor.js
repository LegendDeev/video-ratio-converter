/**
 * ffmpegProcessor.js
 * Three conversion modes:
 *  blur  – blurred version of video as background
 *  black – pure black background (video centred, original ratio preserved)
 *  crop  – centre crop to fill full 9:16 frame
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
       * bg: scale to cover 1080×1920 → crop exact → heavy boxblur
       * fg: scale to fit inside 1080×1920 → pad to exact canvas
       * composite: overlay fg on bg
       */
      filterComplex =
        `[0:v]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=increase,` +
        `crop=${TARGET_W}:${TARGET_H},` +
        `boxblur=luma_radius=50:luma_power=2[bg];` +
        `[0:v]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,` +
        `pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:color=black@0[fg];` +
        `[bg][fg]overlay=0:0[out]`;

    } else if (mode === 'black') {
      /**
       * BLACK BACKGROUND MODE
       * Same as blur but background is a solid black canvas instead of
       * a blurred video. Video is scaled to fit (letterboxed) and centred.
       *
       * color=black:size=1080x1920 → generates a solid black 1080×1920 canvas
       * fg: scale to fit inside 1080×1920 → pad transparent to exact canvas
       * overlay fg centred on black bg
       */
      filterComplex =
        `color=black:size=${TARGET_W}x${TARGET_H}:rate=30[bg];` +
        `[0:v]scale=${TARGET_W}:${TARGET_H}:force_original_aspect_ratio=decrease,` +
        `pad=${TARGET_W}:${TARGET_H}:(ow-iw)/2:(oh-ih)/2:color=black@0[fg];` +
        `[bg][fg]overlay=0:0[out]`;

    } else {
      /**
       * CENTRE CROP MODE
       * Scale to cover 1080×1920 canvas then crop centre.
       * Works correctly for landscape (16:9) sources.
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
