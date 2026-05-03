import React, { useState, useEffect, useCallback } from 'react';
import API_BASE from '../api';

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function StorageManager() {
  const [stats, setStats]       = useState(null);
  const [loading, setLoading]   = useState(false);
  const [clearing, setClearing] = useState(false);
  const [message, setMessage]   = useState('');
  const [expanded, setExpanded] = useState(false);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/storage`);
      if (res.ok) setStats(await res.json());
    } catch (_) {}
    setLoading(false);
  }, []);

  useEffect(() => { if (expanded) fetchStats(); }, [expanded, fetchStats]);

  async function handleClearAll() {
    if (!window.confirm('Delete ALL uploaded and converted videos from the server?\nThis cannot be undone.')) return;
    setClearing(true); setMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/cleanup/all`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        setMessage(`✓ Deleted ${data.deleted} file${data.deleted !== 1 ? 's' : ''} successfully.`);
        await fetchStats();
      } else {
        setMessage('✗ Server error while deleting files.');
      }
    } catch { setMessage('✗ Could not reach server.'); }
    setClearing(false);
  }

  return (
    <div style={{ margin: '32px auto 0', maxWidth: 520, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden', fontFamily: "'DM Mono', monospace" }}>
      <button onClick={() => setExpanded(e => !e)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '13px 18px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.75rem', letterSpacing: '0.5px' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/>
          </svg>
          SERVER STORAGE MANAGER
        </span>
        <span style={{ fontSize: '0.65rem' }}>{expanded ? '▲ HIDE' : '▼ SHOW'}</span>
      </button>

      {expanded && (
        <div style={{ padding: '0 18px 18px', borderTop: '1px solid var(--border)' }}>
          <div style={{ paddingTop: 14, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
            {[
              { label: 'Uploads', data: stats?.uploads },
              { label: 'Converted', data: stats?.outputs },
              { label: 'Total', data: stats?.total },
            ].map(({ label, data }) => (
              <div key={label} style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, padding: '10px 12px' }}>
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontSize: '0.95rem', color: 'var(--text)', fontWeight: 600 }}>
                  {loading || !data ? '…' : `${data.count} file${data.count !== 1 ? 's' : ''}`}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                  {loading || !data ? '' : formatBytes(data.bytes)}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={fetchStats} disabled={loading} style={{ flex: 1, padding: '9px 14px', background: 'none', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-muted)', fontSize: '0.75rem', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace" }}>
              {loading ? 'Refreshing…' : '↻ Refresh'}
            </button>
            <button onClick={handleClearAll} disabled={clearing || loading || stats?.total?.count === 0} style={{ flex: 2, padding: '9px 14px', background: 'rgba(255,87,87,0.1)', border: '1px solid rgba(255,87,87,0.35)', borderRadius: 8, color: '#ff5757', fontSize: '0.75rem', cursor: (clearing || stats?.total?.count === 0) ? 'not-allowed' : 'pointer', fontFamily: "'DM Mono', monospace", opacity: stats?.total?.count === 0 ? 0.4 : 1 }}>
              {clearing ? 'Deleting…' : '🗑  Delete All Server Files'}
            </button>
          </div>
          {message && (
            <div style={{ marginTop: 12, padding: '9px 13px', borderRadius: 8, fontSize: '0.75rem', background: message.startsWith('✓') ? 'rgba(184,255,87,0.08)' : 'rgba(255,87,87,0.08)', border: `1px solid ${message.startsWith('✓') ? 'rgba(184,255,87,0.25)' : 'rgba(255,87,87,0.25)'}`, color: message.startsWith('✓') ? 'var(--accent)' : '#ff5757' }}>
              {message}
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: '0.68rem', color: 'var(--text-muted)', lineHeight: 1.6 }}>
            Files are also auto-deleted when you click "Convert another video".<br />
            Use this to manually clear space if you cancelled mid-way.
          </div>
        </div>
      )}
    </div>
  );
}
