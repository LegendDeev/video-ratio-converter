import React, { useRef, useState } from 'react';
import API_BASE from '../api';

const ACCEPTED = 'video/mp4,video/quicktime,video/x-msvideo,video/x-matroska,video/webm,video/x-m4v';

export default function VideoUploader({ onUploadSuccess }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  function handleFiles(files) {
    const file = files[0];
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setError('Please select a valid video file (mp4, mov, avi, mkv, webm).');
      return;
    }
    setError('');
    uploadFile(file);
  }

  async function uploadFile(file) {
    setUploading(true);
    const formData = new FormData();
    formData.append('video', file);
    try {
      const res = await fetch(`${API_BASE}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed.');
      onUploadSuccess({ ...data, localFile: file });
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
    }
  }

  function onDrop(e) {
    e.preventDefault();
    setDragOver(false);
    handleFiles(e.dataTransfer.files);
  }

  return (
    <>
      <div
        className={`upload-zone${dragOver ? ' drag-over' : ''}`}
        onClick={() => !uploading && inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        role="button" tabIndex={0}
        onKeyDown={e => e.key === 'Enter' && inputRef.current.click()}
        aria-label="Upload video"
      >
        <div className="upload-icon">
          {uploading ? (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="#7070a0" strokeWidth="2" />
              <path d="M12 3a9 9 0 0 1 9 9" stroke="#b8ff57" strokeWidth="2" strokeLinecap="round">
                <animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="0.8s" repeatCount="indefinite" />
              </path>
            </svg>
          ) : (
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#7070a0" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
          )}
        </div>
        <p className="upload-headline">{uploading ? 'Uploading…' : 'Drop your video here'}</p>
        <p className="upload-sub">
          {uploading ? 'Please wait while we read your file'
            : <><strong>click to browse</strong> — MP4, MOV, AVI, MKV, WEBM</>}
        </p>
        <input ref={inputRef} type="file" accept={ACCEPTED}
          style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} disabled={uploading} />
      </div>
      {error && (
        <div className="alert alert-error" style={{ marginTop: 14 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ flexShrink: 0, marginTop: 1 }}>
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
        </div>
      )}
    </>
  );
}
