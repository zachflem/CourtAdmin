import { useRef, useState } from 'react';
import './ImageUpload.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function ImageUpload({ slot, currentUrl, onUpdate, label }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const inputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append('file', file);

    try {
      const res = await fetch(`${API_BASE}/api/upload-${slot}`, {
        method: 'POST',
        body: fd,
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Upload failed');
      onUpdate(data.url);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  async function handleDelete() {
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/delete-${slot}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Delete failed');
      }
      onUpdate(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="image-upload">
      <span className="image-upload-label">{label}</span>

      {currentUrl ? (
        <div className="image-upload-preview">
          <img src={currentUrl} alt={label} className="image-upload-img" />
          <div className="image-upload-actions">
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
            >
              {loading ? 'Working…' : 'Replace'}
            </button>
            <button
              className="btn btn-danger btn-sm"
              onClick={handleDelete}
              disabled={loading}
            >
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          className="btn btn-secondary"
          onClick={() => inputRef.current?.click()}
          disabled={loading}
        >
          {loading ? 'Uploading…' : `Upload ${label}`}
        </button>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".jpg,.jpeg,.png,.gif,.webp"
        onChange={handleFileChange}
        style={{ display: 'none' }}
      />

      {error && <span className="image-upload-error">{error}</span>}
    </div>
  );
}
