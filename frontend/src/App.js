import React, { useState } from 'react';
import './App.css';
import VideoUploader from './components/VideoUploader';
import VideoPreview from './components/VideoPreview';
import ConvertPanel from './components/ConvertPanel';
import StorageManager from './components/StorageManager';

export default function App() {
  const [fileInfo, setFileInfo] = useState(null);

  return (
    <div className="app">
      <header className="header">
        <div className="header-logo">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <line x1="8" y1="21" x2="16" y2="21" />
            <line x1="12" y1="17" x2="12" y2="21" />
          </svg>
        </div>
        <h1 className="header-title">Reel<span>Cut</span></h1>
        <span className="header-badge">Horizontal → 9:16</span>
      </header>

      <main className="main">
        {!fileInfo ? (
          <>
            <div className="step-label">Get started</div>
            <h2 className="section-title">
              Convert any video to<br />vertical format instantly
            </h2>
            <VideoUploader onUploadSuccess={setFileInfo} />

            <div style={{ marginTop: 24, padding: '16px 20px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: "'DM Mono', monospace", lineHeight: 1.7 }}>
              <strong style={{ color: 'var(--text)', fontFamily: "'Syne', sans-serif" }}>How it works</strong><br />
              1. Upload your horizontal (16:9) video<br />
              2. Choose <em>Blur Background</em> or <em>Centre Crop</em><br />
              3. Hit Convert — FFmpeg processes at H.264 CRF 18 (near-lossless)<br />
              4. Download your 1080×1920 vertical MP4
            </div>

            <StorageManager />
          </>
        ) : (
          <>
            <div className="step-label">Step 2 of 2</div>
            <h2 className="section-title">Preview & Convert</h2>
            <div className="two-col">
              <VideoPreview fileInfo={fileInfo} onReset={() => setFileInfo(null)} />
              <ConvertPanel fileInfo={fileInfo} onReset={() => setFileInfo(null)} />
            </div>
          </>
        )}
      </main>

      <footer className="footer">
        ReelCut · powered by FFmpeg · H.264 / CRF 18 · 1080×1920 output
      </footer>
    </div>
  );
}
