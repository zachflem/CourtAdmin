import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './DocumentsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const SUGGESTED_CATEGORIES = ['General', 'Registration', 'Policies', 'Forms', 'Codes of Conduct', 'Other'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

async function apiUpload(path, formData, method = 'POST') {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    credentials: 'include',
    body: formData,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Upload failed (${res.status})`);
  }
  return res.json();
}

// ─── File Type Badge ──────────────────────────────────────────────────────────

function FileTypeBadge({ fileName }) {
  const ext = (fileName || '').split('.').pop()?.toLowerCase() ?? '';
  const map = {
    pdf: { label: 'PDF', cls: 'file-type--pdf' },
    doc: { label: 'DOC', cls: 'file-type--doc' },
    docx: { label: 'DOC', cls: 'file-type--doc' },
    jpg: { label: 'IMG', cls: 'file-type--img' },
    jpeg: { label: 'IMG', cls: 'file-type--img' },
    png: { label: 'IMG', cls: 'file-type--img' },
    gif: { label: 'IMG', cls: 'file-type--img' },
    webp: { label: 'IMG', cls: 'file-type--img' },
  };
  const info = map[ext] || { label: ext.toUpperCase() || 'FILE', cls: 'file-type--generic' };
  return <span className={`file-type-badge ${info.cls}`}>{info.label}</span>;
}

// ─── Category Badge ───────────────────────────────────────────────────────────

function CategoryBadge({ category }) {
  return <span className="category-badge">{category}</span>;
}

// ─── Upload Document Dialog ───────────────────────────────────────────────────

function UploadDocumentDialog({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('General');
  const [description, setDescription] = useState('');
  const [version, setVersion] = useState('1.0');
  const [requiresAck, setRequiresAck] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [file, setFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) { setError('Title is required.'); return; }
    if (!file) { setError('Please select a file.'); return; }

    setSaving(true);
    setError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('category', category.trim() || 'General');
      fd.append('description', description.trim());
      fd.append('version', version.trim() || '1.0');
      fd.append('requires_acknowledgement', String(requiresAck));
      fd.append('is_public', String(isPublic));
      fd.append('file', file);
      const doc = await apiUpload('/api/documents', fd);
      onCreate(doc);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">Upload Document</h2>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>
        <form className="dialog-form" onSubmit={handleSubmit}>
          <label className="field-label">
            Title *
            <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Registration Form 2025" required />
          </label>
          <div className="field-row">
            <label className="field-label">
              Category
              <input
                className="field-input"
                list="doc-categories"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="e.g. Registration"
              />
              <datalist id="doc-categories">
                {SUGGESTED_CATEGORIES.map((c) => <option key={c} value={c} />)}
              </datalist>
            </label>
            <label className="field-label">
              Version
              <input className="field-input" value={version} onChange={(e) => setVersion(e.target.value)} placeholder="1.0" />
            </label>
          </div>
          <label className="field-label">
            Description
            <textarea className="field-input field-textarea" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description of this document…" />
          </label>
          <div className="field-checkboxes">
            <label className="field-checkbox">
              <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} />
              Requires acknowledgement from members
            </label>
            <label className="field-checkbox">
              <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
              Public (visible without login on homepage)
            </label>
          </div>
          <label className="field-label">
            File *
            <input
              type="file"
              className="field-input"
              accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              required
            />
            <span className="field-hint">PDF, DOC, DOCX, or image — max 20 MB</span>
          </label>
          {error && <p className="dialog-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Uploading…' : 'Upload'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Manage Document Dialog ───────────────────────────────────────────────────

function ManageDocumentDialog({ doc, onClose, onUpdate, onDelete, canEdit }) {
  const [tab, setTab] = useState('details');

  // Details tab state
  const [title, setTitle] = useState(doc.title);
  const [category, setCategory] = useState(doc.category);
  const [description, setDescription] = useState(doc.description || '');
  const [version, setVersion] = useState(doc.version);
  const [requiresAck, setRequiresAck] = useState(!!doc.requires_acknowledgement);
  const [isPublic, setIsPublic] = useState(!!doc.is_public);
  const [newFile, setNewFile] = useState(null);
  const [saving, setSaving] = useState(false);
  const [detailsError, setDetailsError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Acknowledgements tab state
  const [ackData, setAckData] = useState(null);
  const [ackLoading, setAckLoading] = useState(false);
  const [ackError, setAckError] = useState('');

  async function loadAcknowledgements() {
    if (ackData || ackLoading) return;
    setAckLoading(true);
    setAckError('');
    try {
      const data = await apiFetch(`/api/documents/${doc.id}/acknowledgements`);
      setAckData(data);
    } catch (err) {
      setAckError(err.message);
    } finally {
      setAckLoading(false);
    }
  }

  function handleTabChange(t) {
    setTab(t);
    if (t === 'acknowledgements' && canEdit) loadAcknowledgements();
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!title.trim()) { setDetailsError('Title is required.'); return; }
    setSaving(true);
    setDetailsError('');
    try {
      const fd = new FormData();
      fd.append('title', title.trim());
      fd.append('category', category.trim() || 'General');
      fd.append('description', description.trim());
      fd.append('version', version.trim() || '1.0');
      fd.append('requires_acknowledgement', String(requiresAck));
      fd.append('is_public', String(isPublic));
      if (newFile) fd.append('file', newFile);
      const updated = await apiUpload(`/api/documents/${doc.id}`, fd, 'PUT');
      onUpdate(updated);
    } catch (err) {
      setDetailsError(err.message);
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/documents/${doc.id}`, { method: 'DELETE' });
      onDelete(doc.id);
    } catch (err) {
      setDetailsError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  const totalAck = (ackData?.acknowledged?.length ?? 0);
  const totalNotAck = (ackData?.not_acknowledged?.length ?? 0);
  const total = totalAck + totalNotAck;

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">{doc.title}</h2>
          <button className="dialog-close" onClick={onClose}>✕</button>
        </div>

        {canEdit && (
          <div className="tab-bar">
            <button className={`tab-btn${tab === 'details' ? ' tab-btn--active' : ''}`} onClick={() => handleTabChange('details')}>Details</button>
            {doc.requires_acknowledgement && (
              <button className={`tab-btn${tab === 'acknowledgements' ? ' tab-btn--active' : ''}`} onClick={() => handleTabChange('acknowledgements')}>
                Acknowledgements
              </button>
            )}
          </div>
        )}

        {tab === 'details' && (
          <form className="dialog-form tab-section" onSubmit={handleSave}>
            <label className="field-label">
              Title *
              <input className="field-input" value={title} onChange={(e) => setTitle(e.target.value)} required />
            </label>
            <div className="field-row">
              <label className="field-label">
                Category
                <input
                  className="field-input"
                  list="doc-categories-edit"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                />
                <datalist id="doc-categories-edit">
                  {SUGGESTED_CATEGORIES.map((c) => <option key={c} value={c} />)}
                </datalist>
              </label>
              <label className="field-label">
                Version
                <input className="field-input" value={version} onChange={(e) => setVersion(e.target.value)} />
              </label>
            </div>
            <label className="field-label">
              Description
              <textarea className="field-input field-textarea" value={description} onChange={(e) => setDescription(e.target.value)} />
            </label>
            <div className="field-checkboxes">
              <label className="field-checkbox">
                <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} />
                Requires acknowledgement from members
              </label>
              <label className="field-checkbox">
                <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
                Public (visible without login)
              </label>
            </div>
            <div className="field-label">
              Replace File
              <p className="field-hint">Current: {doc.file_name}</p>
              <input
                type="file"
                className="field-input"
                accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
                onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
              />
              <span className="field-hint">Leave blank to keep existing file</span>
            </div>
            {detailsError && <p className="dialog-error">{detailsError}</p>}
            <div className="dialog-actions dialog-actions--spread">
              {confirmDelete ? (
                <div className="delete-confirm">
                  <span className="delete-confirm-text">Delete this document?</span>
                  <button type="button" className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
                    {deleting ? 'Deleting…' : 'Yes, delete'}
                  </button>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
                </div>
              ) : (
                <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirmDelete(true)}>
                  Delete
                </button>
              )}
              <div className="dialog-actions">
                <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        )}

        {tab === 'acknowledgements' && (
          <div className="tab-section">
            {ackLoading && <p className="loading-text">Loading acknowledgements…</p>}
            {ackError && <p className="dialog-error">{ackError}</p>}
            {ackData && (
              <>
                <p className="ack-summary">
                  <strong>{totalAck} of {total}</strong> active members have acknowledged this document.
                </p>
                {totalAck > 0 && (
                  <div className="ack-section">
                    <p className="ack-section-label">Acknowledged ({totalAck})</p>
                    <table className="ack-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                          <th>Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ackData.acknowledged.map((u) => (
                          <tr key={u.id}>
                            <td>{u.first_name} {u.last_name}</td>
                            <td className="ack-email">{u.email}</td>
                            <td className="ack-date">{new Date(u.acknowledged_at).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {totalNotAck > 0 && (
                  <div className="ack-section">
                    <p className="ack-section-label ack-section-label--pending">Not Yet Acknowledged ({totalNotAck})</p>
                    <table className="ack-table">
                      <thead>
                        <tr>
                          <th>Name</th>
                          <th>Email</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ackData.not_acknowledged.map((u) => (
                          <tr key={u.id}>
                            <td>{u.first_name} {u.last_name}</td>
                            <td className="ack-email">{u.email}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Documents Page ───────────────────────────────────────────────────────────

export function DocumentsPage() {
  const { user } = useAuth();
  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const canEdit = roles.includes('admin') || roles.includes('committee');

  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [showUpload, setShowUpload] = useState(false);
  const [managingDoc, setManagingDoc] = useState(null);
  const [ackInProgress, setAckInProgress] = useState(new Set());

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiFetch('/api/documents');
      setDocuments(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Derive category list from loaded documents
  const categories = ['all', ...new Set(documents.map((d) => d.category).filter(Boolean).sort())];

  const filtered = filterCategory === 'all'
    ? documents
    : documents.filter((d) => d.category === filterCategory);

  function handleCreate(doc) {
    setDocuments((prev) => [doc, ...prev]);
    setShowUpload(false);
  }

  function handleUpdate(updated) {
    setDocuments((prev) => prev.map((d) => (d.id === updated.id ? { ...d, ...updated } : d)));
    setManagingDoc(null);
  }

  function handleDelete(id) {
    setDocuments((prev) => prev.filter((d) => d.id !== id));
    setManagingDoc(null);
  }

  async function handleAcknowledge(docId) {
    if (ackInProgress.has(docId)) return;
    setAckInProgress((prev) => new Set([...prev, docId]));
    try {
      const result = await apiFetch(`/api/documents/${docId}/acknowledge`, { method: 'POST' });
      setDocuments((prev) =>
        prev.map((d) =>
          d.id === docId ? { ...d, user_has_acknowledged: 1, acknowledged_at: result.acknowledged_at } : d
        )
      );
    } catch (err) {
      // silent fail — user can retry
    } finally {
      setAckInProgress((prev) => {
        const next = new Set(prev);
        next.delete(docId);
        return next;
      });
    }
  }

  const pendingAckCount = documents.filter((d) => d.requires_acknowledgement && !d.user_has_acknowledged).length;

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Documents</h1>
          <p className="page-subtitle">
            {canEdit ? 'Upload and manage club documents.' : 'Club documents and resources.'}
            {!canEdit && pendingAckCount > 0 && (
              <span className="ack-pending-notice"> {pendingAckCount} document{pendingAckCount > 1 ? 's' : ''} require your acknowledgement.</span>
            )}
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowUpload(true)}>
            + Upload Document
          </button>
        )}
      </div>

      {error && <p className="page-error">{error}</p>}

      {categories.length > 1 && (
        <div className="docs-filter-bar">
          {categories.map((cat) => (
            <button
              key={cat}
              className={`filter-btn${filterCategory === cat ? ' filter-btn--active' : ''}`}
              onClick={() => setFilterCategory(cat)}
            >
              {cat === 'all' ? 'All' : cat}
            </button>
          ))}
        </div>
      )}

      {loading && <p className="loading-text">Loading documents…</p>}

      {!loading && filtered.length === 0 && (
        <p className="empty-text">
          {filterCategory === 'all' ? 'No documents uploaded yet.' : `No documents in "${filterCategory}".`}
        </p>
      )}

      {!loading && filtered.length > 0 && (
        <div className="docs-list">
          {filtered.map((doc) => (
            <div key={doc.id} className="doc-row">
              <div className="doc-row-icon">
                <FileTypeBadge fileName={doc.file_name} />
              </div>
              <div className="doc-row-main">
                <div className="doc-row-header">
                  <span className="doc-title">{doc.title}</span>
                  <CategoryBadge category={doc.category} />
                  {doc.version && doc.version !== '1.0' && (
                    <span className="doc-version">v{doc.version}</span>
                  )}
                  {doc.is_public ? <span className="badge-public">Public</span> : null}
                </div>
                {doc.description && (
                  <p className="doc-description">{doc.description}</p>
                )}
                <p className="doc-filename">{doc.file_name}</p>
              </div>
              <div className="doc-row-actions">
                {doc.requires_acknowledgement && (
                  doc.user_has_acknowledged ? (
                    <span className="ack-badge ack-badge--done" title={doc.acknowledged_at ? `Acknowledged ${new Date(doc.acknowledged_at).toLocaleDateString()}` : ''}>
                      ✓ Acknowledged
                    </span>
                  ) : (
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => handleAcknowledge(doc.id)}
                      disabled={ackInProgress.has(doc.id)}
                    >
                      {ackInProgress.has(doc.id) ? 'Saving…' : 'Acknowledge'}
                    </button>
                  )
                )}
                <a
                  className="btn btn-sm btn-ghost"
                  href={`${API_BASE}${doc.file_url}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                >
                  Download
                </a>
                {canEdit && (
                  <button className="btn btn-sm btn-ghost" onClick={() => setManagingDoc(doc)}>
                    Edit
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDocumentDialog onClose={() => setShowUpload(false)} onCreate={handleCreate} />
      )}

      {managingDoc && (
        <ManageDocumentDialog
          doc={managingDoc}
          onClose={() => setManagingDoc(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
