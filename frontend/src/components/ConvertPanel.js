import React, { useState, useRef } from 'react';
import API_BASE from '../api';

const MODES = [
  {
    id: 'blur',
    label: 'Blur Background',
    desc: 'Full video visible. Blurred version of itself fills the sides.',
    recommended: true,
    preview: { top: '#1a1a1a', mid: '#4a4a6a', style: 'blur' },
  },
  {
    id: 'black',
    label: 'Black Background',
    desc: 'Full video centred on a clean solid black background. Great for a cinematic look.',
    recommended: false,
    preview: { top: '#000000', mid: '#000000', style: 'black' },
  },
  {
    id: 'crop',
    label: 'Centre Crop',
    desc: 'Crops edges so subject fills the full vertical frame.',
    recommended: false,
    preview: { style: 'crop' },
  },
];

/* Tiny visual preview icon for each mode */
function ModeIcon({ style }) {
  const w = 22, h = 36, vw = 14, vh = 9; // video area inside canvas
  const vx = (w - vw) / 2, vy = (h - vh) / 2;

  if (style === 'blur') return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <rect width={w} height={h} rx="2" fill="#2a2a4a" />
      {/* blurred sides hint */}
      <rect x="0" y={vy} width={vx} height={vh} fill="#3a3a6a" opacity="0.7" />
      <rect x={vx + vw} y={vy} width={vx} height={vh} fill="#3a3a6a" opacity="0.7" />
      {/* main video */}
      <rect x={vx} y={vy} width={vw} height={vh} rx="1" fill="#6060aa" />
      <rect x={vx + 2} y={vy + 2} width={8} height={5} rx="0.5" fill="#8080cc" opacity="0.6" />
    </svg>
  );

  if (style === 'black') return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <rect width={w} height={h} rx="2" fill="#000" />
      {/* main video centred */}
      <rect x={vx} y={vy} width={vw} height={vh} rx="1" fill="#6060aa" />
      <rect x={vx + 2} y={vy + 2} width={8} height={5} rx="0.5" fill="#8080cc" opacity="0.6" />
    </svg>
  );

  // crop — video fills full frame
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ flexShrink: 0 }}>
      <rect width={w} height={h} rx="2" fill="#6060aa" />
      <rect x="2" y="4" width={w - 4} height={h - 8} rx="1" fill="#8080cc" opacity="0.5" />
    </svg>
  );
}

export default function ConvertPanel({ fileInfo, onReset }) {
  const [mode, setMode] = useState('blur');
  const [status, setStatus] = useState('idle');
  const [progress, setProgress] = useState(0);
  const [outputFilename, setOutputFilename] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const eventSourceRef = useRef(null);

  function cleanupSSE() {
    if (eventSourceRef.current) { eventSourceRef.current.close(); eventSourceRef.current = null; }
  }

  async function startConversion() {
    setStatus('converting'); setProgress(0); setErrorMsg('');
    try {
      const res = await fetch(`${API_BASE}/api/convert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: fileInfo.filename, mode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Conversion failed to start.');

      const { jobId, outputFilename: outFile } = data;
      setOutputFilename(outFile);

      const es = new EventSource(`${API_BASE}/api/progress/${jobId}`);
      eventSourceRef.current = es;
      es.onmessage = (evt) => {
        const { percent, done, error } = JSON.parse(evt.data);
        if (error) { setErrorMsg(error); setStatus('error'); cleanupSSE(); return; }
        setProgress(percent);
        if (done) { setStatus('done'); cleanupSSE(); }
      };
      es.onerror = () => { setErrorMsg('Lost connection to server.'); setStatus('error'); cleanupSSE(); };
    } catch (err) {
      setErrorMsg(err.message); setStatus('error');
    }
  }

  async function handleDownload() {
    try {
      const res = await fetch(`${API_BASE}/api/download/${outputFilename}`);
      if (!res.ok) throw new Error('File not found on server');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'vertical_video.mp4';
      document.body.appendChild(a); a.click(); a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('Download failed: ' + err.message);
    }
  }

  function handleReset() {
    cleanupSSE();
    if (fileInfo.filename) {
      fetch(`${API_BASE}/api/cleanup`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ uploadFilename: fileInfo.filename, outputFilename }),
      }).catch(() => {});
    }
    onReset();
  }

  const isConverting = status === 'converting';
  const isDone       = status === 'done';
  const isError      = status === 'error';

  return (
    <div className="convert-panel">
      <div className="convert-panel-header">
        <h3>Conversion Settings</h3>
        <p>Target: 1080 × 1920 · H.264 · CRF 18</p>
      </div>

      <div className="convert-panel-body">
        {/* Mode selector */}
        <div className="mode-options">
          {MODES.map(m => (
            <div
              key={m.id}
              className={`mode-option${mode === m.id ? ' selected' : ''}`}
              onClick={() => !isConverting && !isDone && setMode(m.id)}
              role="radio"
              aria-checked={mode === m.id}
              tabIndex={0}
              onKeyDown={e => e.key === 'Enter' && setMode(m.id)}
            >
              <div className="mode-radio"><div className="mode-radio-dot" /></div>

              {/* tiny visual preview */}
              <ModeIcon style={m.preview.style} />

              <div className="mode-text">
                <strong>
                  {m.label}
                  {m.recommended && (
                    <span style={{ marginLeft: 8, fontSize: '0.67rem', background: 'var(--accent)', color: '#000', borderRadius: 4, padding: '1px 6px', fontWeight: 700, verticalAlign: 'middle' }}>
                      RECOMMENDED
                    </span>
                  )}
                </strong>
                <span>{m.desc}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Convert button */}
        {!isDone && (
          <button className="btn-convert" onClick={startConversion} disabled={isConverting}>
            {isConverting ? (
              <><div className="spinner" />Converting…</>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Convert to 9:16 Vertical
              </>
            )}
          </button>
        )}

        {/* Progress */}
        {isConverting && (
          <div className="progress-section">
            <div className="progress-header">
              <span className="progress-label">Processing with FFmpeg</span>
              <span className="progress-pct">{progress}%</span>
            </div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="alert alert-error">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
              <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {errorMsg}
          </div>
        )}

        {/* Done */}
        {isDone && (
          <>
            <div className="alert alert-success">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Conversion complete! Your vertical video is ready.
            </div>
            <button className="btn-download" onClick={handleDownload}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download vertical_video.mp4
            </button>
          </>
        )}

        <button className="btn-reset" onClick={handleReset}>
          {isDone ? '⟵ Convert another video' : 'Cancel & start over'}
        </button>
      </div>
    </div>
  );
}
