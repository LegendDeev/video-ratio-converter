# ReelCut – Horizontal → Vertical Video Converter

Convert any 16:9 (landscape) video into 9:16 (portrait / 1080×1920) format
for **Instagram Reels** and **YouTube Shorts** — directly in your browser.

Two modes:
- **Blur Background** *(default)* – The full original video is shown, pillarboxed
  with a blurred version of itself as a colourful background. No content is lost.
- **Centre Crop** – Crops the left/right edges so the subject fills the vertical
  frame. Best when your subject is always in the centre.

FFmpeg encodes output as H.264, CRF 18 (near-lossless), 1080×1920, AAC 192 kbps.

---

## Folder Structure

```
video-converter/
├── backend/
│   ├── package.json          ← Node.js dependencies
│   ├── server.js             ← Express API server
│   ├── ffmpegProcessor.js    ← All FFmpeg logic
│   ├── .env.example          ← Environment variable template
│   ├── uploads/              ← Created at runtime (temp input files)
│   └── outputs/              ← Created at runtime (converted files)
│
├── frontend/
│   ├── package.json
│   ├── public/
│   │   └── index.html
│   └── src/
│       ├── index.js
│       ├── index.css
│       ├── App.js
│       ├── App.css
│       └── components/
│           ├── VideoUploader.js   ← Drag-and-drop upload
│           ├── VideoPreview.js    ← Original video preview
│           └── ConvertPanel.js    ← Mode selector, progress, download
│
├── setup.sh                  ← One-shot dependency installer
└── README.md
```

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 18 | https://nodejs.org |
| npm | ≥ 9 (bundled with Node) | — |
| FFmpeg | any recent | see below |

### Installing FFmpeg

**macOS (Homebrew)**
```bash
brew install ffmpeg
```

**Ubuntu / Debian**
```bash
sudo apt update && sudo apt install -y ffmpeg
```

**Windows**
1. Download a build from https://www.gyan.dev/ffmpeg/builds/ (e.g. `ffmpeg-release-essentials.zip`)
2. Extract and add the `bin/` folder to your `PATH` environment variable.
3. Verify: `ffmpeg -version`

---

## Quick Start (3 terminals)

### 1 – Install all dependencies

```bash
cd video-converter
bash setup.sh          # installs both backend and frontend deps
```

Or manually:
```bash
cd backend  && npm install
cd ../frontend && npm install
```

### 2 – Configure environment (optional)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env if needed (e.g. change PORT, or set explicit FFmpeg paths)
```

### 3 – Start the backend

```bash
cd backend
npm start
# ✅ Running on http://localhost:5000
```

### 4 – Start the frontend

Open a **second terminal**:

```bash
cd frontend
npm start
# Opens http://localhost:3000 automatically
```

### 5 – Use the app

1. Open **http://localhost:3000** in your browser
2. Drag & drop (or click to browse) your horizontal video
3. Choose **Blur Background** or **Centre Crop**
4. Click **Convert to 9:16 Vertical**
5. Watch the real-time progress bar
6. Click **Download** when complete

---

## FFmpeg Commands (for reference)

### Blur background mode
```
ffmpeg -i input.mp4 \
  -filter_complex "
    [0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,boxblur=luma_radius=50:luma_power=2[bg];
    [0:v]scale=1080:1920:force_original_aspect_ratio=decrease,pad=1080:1920:(ow-iw)/2:(oh-ih)/2:color=black@0[fg];
    [bg][fg]overlay=0:0[out]
  " \
  -map "[out]" -map 0:a? \
  -c:v libx264 -crf 18 -preset medium -profile:v high \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart \
  output_vertical.mp4
```

### Centre-crop mode
```
ffmpeg -i input.mp4 \
  -filter_complex "[0:v]scale=1080:-2,crop=1080:1920[out]" \
  -map "[out]" -map 0:a? \
  -c:v libx264 -crf 18 -preset medium -profile:v high \
  -pix_fmt yuv420p -c:a aac -b:a 192k -movflags +faststart \
  output_vertical.mp4
```

**Quality knob:** Lower CRF = higher quality / larger file.
- CRF 18 = near-lossless (default)
- CRF 23 = good quality, smaller file
- CRF 28 = acceptable for drafts

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `5000` | Backend server port |
| `MAX_FILE_SIZE_MB` | `500` | Max upload size in MB |
| `FFMPEG_PATH` | *(system PATH)* | Explicit path to `ffmpeg` binary |
| `FFPROBE_PATH` | *(system PATH)* | Explicit path to `ffprobe` binary |

---

## Notes & Assumptions

- Files are stored temporarily in `backend/uploads/` and `backend/outputs/`.
  They are deleted when you click "Convert another video" or call `/api/cleanup`.
  For production use, add a cron job to prune old files.
- The React dev server proxies `/api/*` requests to `http://localhost:5000`
  (configured via `"proxy"` in `frontend/package.json`).
- For production, run `npm run build` in the frontend and serve the `build/`
  folder as static files from the Express server.
- Conversion progress is streamed via **Server-Sent Events** (SSE) — no
  WebSockets needed.
