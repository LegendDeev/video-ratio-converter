import React from 'react';
import API_BASE from '../api';

function formatSize(bytes) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
function formatDuration(sec) {
  const s = Math.floor(sec);
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

export default function VideoPreview({ fileInfo, onReset }) {
  const previewUrl = `${API_BASE}/api/preview/${fileInfo.filename}`;
  const isVertical = fileInfo.height > fileInfo.width;

  return (
    <div className="preview-card">
      <div className="preview-card-header">
        <span className="preview-card-label">Original</span>
        <span className="preview-card-badge">
          {fileInfo.width}×{fileInfo.height} · {isVertical ? '9:16' : '16:9'}
        </span>
      </div>
      <div className="video-wrapper">
        <video src={previewUrl} controls playsInline muted
          style={{ maxHeight: 340, objectFit: 'contain', background: '#000' }} />
      </div>
      <div className="file-info" style={{ margin: '0 16px 16px', border: 'none', background: 'transparent', padding: '8px 0 0', borderTop: '1px solid var(--border)' }}>
        <div className="file-info-icon">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#b8ff57" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="23 7 16 12 23 17 23 7" />
            <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
          </svg>
        </div>
        <div className="file-info-details">
          <div className="file-info-name">{fileInfo.originalName}</div>
          <div className="file-info-meta">
            <span>{formatSize(fileInfo.size)}</span>
            {fileInfo.duration && <span>{formatDuration(fileInfo.duration)}</span>}
            <span>{fileInfo.width}×{fileInfo.height}</span>
          </div>
        </div>
        <button className="btn-ghost" onClick={onReset}>Remove</button>
      </div>
    </div>
  );
}
