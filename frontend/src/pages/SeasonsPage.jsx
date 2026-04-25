import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './SeasonsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const EMPTY_FORM = {
  name: '',
  start_date: '',
  end_date: '',
  age_cutoff_date: '',
};

function formatDate(iso) {
  if (!iso) return '—';
  return iso.slice(0, 10);
}

function SeasonDialog({ season, onClose, onSaved }) {
  const isEdit = Boolean(season);
  const [form, setForm] = useState(
    isEdit
      ? {
          name: season.name,
          start_date: season.start_date.slice(0, 10),
          end_date: season.end_date.slice(0, 10),
          age_cutoff_date: season.age_cutoff_date.slice(0, 10),
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const url = isEdit
        ? `${API_BASE}/api/seasons/${season.id}`
        : `${API_BASE}/api/seasons`;
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      const saved = await res.json();
      onSaved(saved, isEdit);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{isEdit ? 'Edit Season' : 'Create Season'}</h2>
        <form onSubmit={handleSubmit} className="dialog-form">
          <label className="field-label">
            Season Name
            <input
              className="field-input"
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="e.g. 2025 Winter"
            />
          </label>

          <div className="field-row">
            <label className="field-label">
              Start Date
              <input
                className="field-input"
                type="date"
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
                required
              />
            </label>
            <label className="field-label">
              End Date
              <input
                className="field-input"
                type="date"
                value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)}
                required
              />
            </label>
          </div>

          <label className="field-label">
            Age Cutoff Date
            <span className="field-hint">Players' ages are calculated as of this date</span>
            <input
              className="field-input"
              type="date"
              value={form.age_cutoff_date}
              onChange={(e) => set('age_cutoff_date', e.target.value)}
              placeholder="Defaults to Jan 1 of start year"
            />
          </label>

          {error && <p className="dialog-error">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Season'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ToggleButton({ label, active, onClick, disabled }) {
  return (
    <button
      className={`toggle-btn ${active ? 'toggle-btn--on' : 'toggle-btn--off'}`}
      onClick={onClick}
      disabled={disabled}
      title={label}
    >
      {label}
    </button>
  );
}

export function SeasonsPage() {
  const { user } = useAuth();
  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const canEdit = roles.includes('admin') || roles.includes('committee');

  const [seasons, setSeasons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editSeason, setEditSeason] = useState(null);
  const [toggling, setToggling] = useState({});

  useEffect(() => {
    fetchSeasons();
  }, []);

  async function fetchSeasons() {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/seasons`, { credentials: 'include' });
      if (!res.ok) throw new Error(`Failed to load seasons (${res.status})`);
      setSeasons(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleSaved(saved, isEdit) {
    if (isEdit) {
      setSeasons((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    } else {
      setSeasons((prev) => [saved, ...prev]);
    }
    setShowCreate(false);
    setEditSeason(null);
  }

  async function toggle(season, field) {
    const key = `${season.id}-${field}`;
    setToggling((t) => ({ ...t, [key]: true }));
    try {
      const res = await fetch(`${API_BASE}/api/seasons/${season.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: !season[field] }),
      });
      if (!res.ok) throw new Error('Toggle failed');
      const updated = await res.json();
      setSeasons((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    } catch {
      // surface nothing — state unchanged
    } finally {
      setToggling((t) => ({ ...t, [key]: false }));
    }
  }

  if (!canEdit) {
    return (
      <div className="page-container">
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Season Management</h1>
        <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
          + Create Season
        </button>
      </div>

      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="loading-text">Loading seasons…</p>
      ) : seasons.length === 0 ? (
        <p className="empty-text">No seasons yet. Create your first season above.</p>
      ) : (
        <div className="seasons-table-wrap">
          <table className="seasons-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Start</th>
                <th>End</th>
                <th>Age Cutoff</th>
                <th>Active</th>
                <th>Open</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {seasons.map((s) => (
                <tr key={s.id}>
                  <td className="season-name">{s.name}</td>
                  <td>{formatDate(s.start_date)}</td>
                  <td>{formatDate(s.end_date)}</td>
                  <td>{formatDate(s.age_cutoff_date)}</td>
                  <td>
                    <ToggleButton
                      label={s.is_active ? 'Active' : 'Inactive'}
                      active={s.is_active}
                      onClick={() => toggle(s, 'is_active')}
                      disabled={toggling[`${s.id}-is_active`]}
                    />
                  </td>
                  <td>
                    <ToggleButton
                      label={s.is_closed ? 'Closed' : 'Open'}
                      active={!s.is_closed}
                      onClick={() => toggle(s, 'is_closed')}
                      disabled={toggling[`${s.id}-is_closed`]}
                    />
                  </td>
                  <td>
                    <button
                      className="btn btn-ghost btn-sm"
                      onClick={() => setEditSeason(s)}
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <SeasonDialog
          season={null}
          onClose={() => setShowCreate(false)}
          onSaved={handleSaved}
        />
      )}
      {editSeason && (
        <SeasonDialog
          season={editSeason}
          onClose={() => setEditSeason(null)}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
