import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './PlayersPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ALL_ROLES = ['admin', 'committee', 'coach', 'manager', 'player', 'parent'];

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

function fullName(u) {
  return `${u.first_name || ''} ${u.last_name || ''}`.trim() || '—';
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function parseRoles(rolesStr) {
  try { return JSON.parse(rolesStr || '[]'); } catch { return []; }
}

function StatusBadge({ isActive }) {
  return (
    <span className={`status-badge ${isActive ? 'status-active' : 'status-inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ─── User Details Dialog ──────────────────────────────────────────────────────

function UserDetailsDialog({ user, isAdmin, onClose, onSaved }) {
  const { settings: clubSettings } = useClub();
  const ageGroups = clubSettings.age_groups || [];
  const [form, setForm] = useState({
    first_name:            user.first_name || '',
    last_name:             user.last_name || '',
    phone:                 user.phone || '',
    address:               user.address || '',
    emergency_contact:     user.emergency_contact || '',
    medical_info:          user.medical_info || '',
    gender:                user.gender || '',
    date_of_birth:         user.date_of_birth || '',
    grading_level:         user.grading_level != null ? String(user.grading_level) : '',
    age_group:             user.age_group || '',
    jersey_number:         user.jersey_number != null ? String(user.jersey_number) : '',
    clearance_required:    user.clearance_required ? '1' : '0',
    clearance_status:      user.clearance_status || '',
    previous_club_name:    user.previous_club_name || '',
    previous_team_name:    user.previous_team_name || '',
    previous_coach_name:   user.previous_coach_name || '',
    first_year_registered: user.first_year_registered || '',
    is_active:             user.is_active ? '1' : '0',
  });
  const [roles, setRoles] = useState(parseRoles(user.roles));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleRole(role) {
    setRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        first_name:            form.first_name,
        last_name:             form.last_name,
        phone:                 form.phone || null,
        address:               form.address || null,
        emergency_contact:     form.emergency_contact || null,
        medical_info:          form.medical_info || null,
        gender:                form.gender || null,
        date_of_birth:         form.date_of_birth || null,
        grading_level:         form.grading_level ? Number(form.grading_level) : null,
        age_group:             form.age_group || null,
        jersey_number:         form.jersey_number ? Number(form.jersey_number) : null,
        clearance_required:    Number(form.clearance_required),
        clearance_status:      form.clearance_status || null,
        previous_club_name:    form.previous_club_name || null,
        previous_team_name:    form.previous_team_name || null,
        previous_coach_name:   form.previous_coach_name || null,
        first_year_registered: form.first_year_registered || null,
        is_active:             Number(form.is_active),
      };

      const [updatedUser] = await Promise.all([
        apiFetch(`/api/users/${user.id}`, { method: 'PUT', body: JSON.stringify(payload) }),
        apiFetch(`/api/users/${user.id}/roles`, { method: 'PUT', body: JSON.stringify({ roles }) }),
      ]);

      onSaved({ ...updatedUser, roles: JSON.stringify(roles) });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide dialog--tall" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Edit Player</h2>
        <p className="dialog-subtitle">{user.email}</p>

        <form onSubmit={handleSave}>
          <fieldset className="form-section">
            <legend className="form-section-title">Personal</legend>
            <div className="form-row">
              <label className="field-label">
                First Name
                <input className="field-input" value={form.first_name} onChange={(e) => set('first_name', e.target.value)} required />
              </label>
              <label className="field-label">
                Last Name
                <input className="field-input" value={form.last_name} onChange={(e) => set('last_name', e.target.value)} required />
              </label>
            </div>
            <div className="form-row">
              <label className="field-label">
                Phone
                <input className="field-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
              </label>
              <label className="field-label">
                Gender
                <select className="field-input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option value="">— select —</option>
                  <option>Male</option>
                  <option>Female</option>
                  <option>Other</option>
                </select>
              </label>
            </div>
            <label className="field-label">
              Date of Birth
              <input type="date" className="field-input" value={form.date_of_birth} onChange={(e) => set('date_of_birth', e.target.value)} />
            </label>
            <label className="field-label">
              Address
              <input className="field-input" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </label>
            <label className="field-label">
              Emergency Contact
              <input className="field-input" value={form.emergency_contact} onChange={(e) => set('emergency_contact', e.target.value)} placeholder="Name — phone" />
            </label>
            <label className="field-label">
              Medical Info
              <textarea className="field-input field-textarea" rows={2} value={form.medical_info} onChange={(e) => set('medical_info', e.target.value)} />
            </label>
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section-title">Club Details</legend>
            <div className="form-row">
              <label className="field-label">
                Age Group
                <select className="field-input" value={form.age_group} onChange={(e) => set('age_group', e.target.value)}>
                  <option value="">— select —</option>
                  {ageGroups.map((g) => <option key={g}>{g}</option>)}
                </select>
              </label>
              <label className="field-label">
                Jersey Number
                <input type="number" min="1" max="99" className="field-input" value={form.jersey_number} onChange={(e) => set('jersey_number', e.target.value)} />
              </label>
            </div>
            <div className="form-row">
              <label className="field-label">
                Grading Level (1–5)
                <input type="number" min="1" max="5" className="field-input" value={form.grading_level} onChange={(e) => set('grading_level', e.target.value)} />
              </label>
              <label className="field-label">
                First Year Registered
                <input type="date" className="field-input" value={form.first_year_registered} onChange={(e) => set('first_year_registered', e.target.value)} />
              </label>
            </div>
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section-title">Clearance</legend>
            <label className="field-label">
              Clearance Required
              <select className="field-input" value={form.clearance_required} onChange={(e) => set('clearance_required', e.target.value)}>
                <option value="0">No</option>
                <option value="1">Yes</option>
              </select>
            </label>
            {form.clearance_required === '1' && (
              <>
                <label className="field-label">
                  Clearance Status
                  <select className="field-input" value={form.clearance_status} onChange={(e) => set('clearance_status', e.target.value)}>
                    <option value="">— select —</option>
                    <option>Pending</option>
                    <option>Approved</option>
                    <option>Rejected</option>
                  </select>
                </label>
                <div className="form-row">
                  <label className="field-label">
                    Previous Club
                    <input className="field-input" value={form.previous_club_name} onChange={(e) => set('previous_club_name', e.target.value)} />
                  </label>
                  <label className="field-label">
                    Previous Team
                    <input className="field-input" value={form.previous_team_name} onChange={(e) => set('previous_team_name', e.target.value)} />
                  </label>
                </div>
                <label className="field-label">
                  Previous Coach
                  <input className="field-input" value={form.previous_coach_name} onChange={(e) => set('previous_coach_name', e.target.value)} />
                </label>
              </>
            )}
          </fieldset>

          <fieldset className="form-section">
            <legend className="form-section-title">Roles &amp; Status</legend>
            <div className="roles-grid">
              {ALL_ROLES.map((role) => (
                <label key={role} className="role-checkbox">
                  <input
                    type="checkbox"
                    checked={roles.includes(role)}
                    onChange={() => toggleRole(role)}
                    disabled={!isAdmin}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>
            <label className="field-label" style={{ marginTop: '0.75rem' }}>
              Account Status
              <select className="field-input" value={form.is_active} onChange={(e) => set('is_active', e.target.value)}>
                <option value="1">Active</option>
                <option value="0">Inactive</option>
              </select>
            </label>
          </fieldset>

          {error && <p className="dialog-error">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Players Tab ──────────────────────────────────────────────────────────────

function PlayersTab({ users, onEditUser }) {
  const [search, setSearch] = useState('');

  const players = users.filter((u) => parseRoles(u.roles).includes('player'));
  const filtered = players.filter((u) => {
    const q = search.toLowerCase();
    return (
      fullName(u).toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      (u.age_group || '').toLowerCase().includes(q)
    );
  });

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search by name, email, or age group…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="toolbar-count">{filtered.length} player{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {filtered.length === 0 ? (
        <p className="empty-text">{players.length === 0 ? 'No registered players yet.' : 'No players match your search.'}</p>
      ) : (
        <div className="table-wrapper">
          <table className="processed-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Age Group</th>
                <th>Jersey</th>
                <th>Grade</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="table-row--clickable" onClick={() => onEditUser(u)}>
                  <td className="td-name">{fullName(u)}</td>
                  <td>{u.email}</td>
                  <td>{u.age_group || '—'}</td>
                  <td>{u.jersey_number != null ? `#${u.jersey_number}` : '—'}</td>
                  <td>{u.grading_level != null ? u.grading_level : '—'}</td>
                  <td><StatusBadge isActive={u.is_active} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Grading Sessions Tab ─────────────────────────────────────────────────────

const GRADE_OPTIONS = [1, 2, 3, 4, 5];
const GENDER_OPTIONS = ['Male', 'Female', 'Mixed'];

function GradingStatusBadge({ status }) {
  const style = {
    committed: { background: '#dcfce7', color: '#15803d' },
    draft:     { background: '#fef3c7', color: '#92400e' },
  }[status] || { background: '#f3f4f6', color: '#6b7280' };
  return (
    <span style={{
      ...style, fontSize: '0.72rem', fontWeight: 600,
      padding: '2px 8px', borderRadius: 999, textTransform: 'capitalize',
    }}>
      {status}
    </span>
  );
}

function CreateGradingSessionDialog({ onClose, onCreated }) {
  const { settings: clubSettings } = useClub();
  const ageGroups = clubSettings.age_groups || [];
  const [seasons, setSeasons] = useState([]);
  const [form, setForm] = useState({
    name: '', season_id: '', age_group: '', gender: 'Mixed',
    notes: '', conducted_at: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch('/api/seasons')
      .then(setSeasons)
      .catch(() => {});
  }, []);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.name.trim()) { setError('Name is required.'); return; }
    if (!form.season_id) { setError('Season is required.'); return; }
    if (!form.age_group) { setError('Age group is required.'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        season_id: form.season_id,
        age_group: form.age_group,
        gender: form.gender,
        notes: form.notes.trim() || null,
        conducted_at: form.conducted_at || null,
      };
      const created = await apiFetch('/api/grading-sessions', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      onCreated(created);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">New Grading Session</h2>
        <form onSubmit={handleSubmit}>
          <label className="field-label">
            Session Name
            <input
              className="field-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. 2025 Pre-Season U12 Girls"
              required
            />
          </label>
          <label className="field-label">
            Season
            <select className="field-input" value={form.season_id} onChange={(e) => set('season_id', e.target.value)} required>
              <option value="">— select season —</option>
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}{s.is_active ? ' (Active)' : ''}</option>
              ))}
            </select>
          </label>
          <div className="form-row">
            <label className="field-label">
              Age Group
              <select className="field-input" value={form.age_group} onChange={(e) => set('age_group', e.target.value)} required>
                <option value="">— select —</option>
                {ageGroups.map((g) => <option key={g}>{g}</option>)}
              </select>
            </label>
            <label className="field-label">
              Gender Filter
              <select className="field-input" value={form.gender} onChange={(e) => set('gender', e.target.value)}>
                {GENDER_OPTIONS.map((g) => <option key={g}>{g}</option>)}
              </select>
            </label>
          </div>
          <label className="field-label">
            Session Date (optional)
            <input type="date" className="field-input" value={form.conducted_at} onChange={(e) => set('conducted_at', e.target.value)} />
          </label>
          <label className="field-label">
            Notes (optional)
            <textarea className="field-input field-textarea" rows={2} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Any notes about this session…" />
          </label>
          {error && <p className="dialog-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function GradingBulkEditor({ session, onCommitted, onBack }) {
  const { settings: clubSettings } = useClub();
  const divisions = clubSettings.divisions || [];

  const [rows, setRows] = useState(() =>
    (session.players || []).map((p) => ({
      id: p.id,
      snapshot_name: p.snapshot_name,
      snapshot_dob: p.snapshot_dob,
      snapshot_age_group: p.snapshot_age_group,
      snapshot_grading_level: p.snapshot_grading_level,
      snapshot_previous_teams: p.snapshot_previous_teams,
      new_grading_level: p.new_grading_level ?? '',
      division_recommendation: p.division_recommendation ?? '',
      coach_notes: p.coach_notes ?? '',
    }))
  );

  const [savingRows, setSavingRows] = useState({});
  const [committing, setCommitting] = useState(false);
  const [confirmCommit, setConfirmCommit] = useState(false);
  const [commitError, setCommitError] = useState('');

  const isCommitted = session.status === 'committed';

  function updateRow(rowId, field, value) {
    setRows((prev) => prev.map((r) => r.id === rowId ? { ...r, [field]: value } : r));
  }

  async function saveRow(row) {
    setSavingRows((prev) => ({ ...prev, [row.id]: true }));
    try {
      await apiFetch(`/api/grading-sessions/${session.id}/players`, {
        method: 'PUT',
        body: JSON.stringify([{
          id: row.id,
          new_grading_level: row.new_grading_level ? Number(row.new_grading_level) : null,
          division_recommendation: row.division_recommendation || null,
          coach_notes: row.coach_notes || null,
        }]),
      });
    } catch { /* silent — user can retry */ }
    setSavingRows((prev) => ({ ...prev, [row.id]: false }));
  }

  async function handleCommit() {
    setCommitError('');
    setCommitting(true);
    try {
      await apiFetch(`/api/grading-sessions/${session.id}/commit`, { method: 'POST' });
      onCommitted();
    } catch (err) {
      setCommitError(err.message);
      setCommitting(false);
    }
  }

  const enteredCount = rows.filter((r) => r.new_grading_level !== '').length;

  function prevTeams(row) {
    try { return (JSON.parse(row.snapshot_previous_teams || '[]')).join(', '); } catch { return ''; }
  }

  return (
    <div className="grading-detail">
      <div className="grading-detail-header">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Sessions</button>
        <div className="grading-detail-title">
          <h2>{session.name}</h2>
          <div className="grading-detail-meta">
            <span className="grading-badge">{session.age_group}</span>
            {session.gender !== 'Mixed' && <span className="grading-badge">{session.gender}</span>}
            <span className="grading-badge">{session.season_name}</span>
            <GradingStatusBadge status={session.status} />
          </div>
        </div>
        <div className="grading-detail-actions">
          <a
            href={`/grading/${session.id}/print`}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
          >
            Print Roster
          </a>
          {!isCommitted && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => setConfirmCommit(true)}
              disabled={enteredCount === 0}
            >
              Commit Results ({enteredCount}/{rows.length})
            </button>
          )}
        </div>
      </div>

      {isCommitted && (
        <div className="grading-committed-notice">
          Results committed — player profiles and feedback records have been updated. This session is now read-only.
        </div>
      )}

      <div className="table-wrapper grading-table-wrapper">
        <table className="processed-table grading-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>DOB</th>
              <th>Prev Team</th>
              <th style={{ textAlign: 'center' }}>Prev Grade</th>
              <th style={{ textAlign: 'center', minWidth: 90 }}>New Grade</th>
              <th style={{ minWidth: 130 }}>Division</th>
              <th>Notes</th>
              {!isCommitted && <th style={{ width: 48 }}></th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="font-medium" style={{ whiteSpace: 'nowrap' }}>{row.snapshot_name}</td>
                <td style={{ color: '#6b7280', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                  {row.snapshot_dob
                    ? new Date(row.snapshot_dob).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '—'}
                </td>
                <td style={{ fontSize: '0.82rem', color: '#6b7280' }}>{prevTeams(row) || '—'}</td>
                <td style={{ textAlign: 'center', fontWeight: 600, color: '#9ca3af' }}>
                  {row.snapshot_grading_level ?? '—'}
                </td>
                <td style={{ textAlign: 'center' }}>
                  {isCommitted ? (
                    <span style={{ fontWeight: 700, color: '#1d4ed8' }}>{row.new_grading_level || '—'}</span>
                  ) : (
                    <select
                      className="field-input grading-select"
                      value={row.new_grading_level}
                      onChange={(e) => updateRow(row.id, 'new_grading_level', e.target.value)}
                      onBlur={() => saveRow(row)}
                    >
                      <option value="">—</option>
                      {GRADE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  {isCommitted ? (
                    <span style={{ fontSize: '0.82rem' }}>{row.division_recommendation || '—'}</span>
                  ) : (
                    <select
                      className="field-input grading-select"
                      value={row.division_recommendation}
                      onChange={(e) => updateRow(row.id, 'division_recommendation', e.target.value)}
                      onBlur={() => saveRow(row)}
                    >
                      <option value="">—</option>
                      {divisions.map((d) => <option key={d}>{d}</option>)}
                    </select>
                  )}
                </td>
                <td>
                  {isCommitted ? (
                    <span style={{ fontSize: '0.82rem' }}>{row.coach_notes || ''}</span>
                  ) : (
                    <input
                      className="field-input grading-notes-input"
                      value={row.coach_notes}
                      onChange={(e) => updateRow(row.id, 'coach_notes', e.target.value)}
                      onBlur={() => saveRow(row)}
                      placeholder="Notes…"
                    />
                  )}
                </td>
                {!isCommitted && (
                  <td style={{ textAlign: 'center', fontSize: '0.75rem', color: '#9ca3af' }}>
                    {savingRows[row.id] ? '…' : ''}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {confirmCommit && (
        <div className="dialog-backdrop" onClick={() => !committing && setConfirmCommit(false)}>
          <div className="dialog" onClick={(e) => e.stopPropagation()}>
            <h2 className="dialog-title">Commit Grading Results?</h2>
            <p style={{ marginBottom: '1rem', color: '#374151' }}>
              This will update <strong>{enteredCount}</strong> player profile{enteredCount !== 1 ? 's' : ''} and create grading feedback records.
              This action cannot be undone.
            </p>
            {commitError && <p className="dialog-error">{commitError}</p>}
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setConfirmCommit(false)} disabled={committing}>Cancel</button>
              <button className="btn btn-primary" onClick={handleCommit} disabled={committing}>
                {committing ? 'Committing…' : 'Commit Results'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function GradingSessionsTab() {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSession, setSelectedSession] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const fetchSessions = useCallback(() => {
    setLoading(true);
    setError('');
    apiFetch('/api/grading-sessions')
      .then(setSessions)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchSessions(); }, [fetchSessions]);

  async function openSession(id) {
    setLoadingDetail(true);
    try {
      const detail = await apiFetch(`/api/grading-sessions/${id}`);
      setSelectedSession(detail);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function deleteSession(id, e) {
    e.stopPropagation();
    if (!window.confirm('Delete this grading session? This cannot be undone.')) return;
    try {
      await apiFetch(`/api/grading-sessions/${id}`, { method: 'DELETE' });
      setSessions((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      alert(err.message);
    }
  }

  function handleCreated(session) {
    setShowCreate(false);
    openSession(session.id);
    fetchSessions();
  }

  function handleCommitted() {
    openSession(selectedSession.id);
    fetchSessions();
  }

  if (selectedSession) {
    if (loadingDetail) return <p className="loading-text">Loading…</p>;
    return (
      <GradingBulkEditor
        session={selectedSession}
        onCommitted={handleCommitted}
        onBack={() => setSelectedSession(null)}
      />
    );
  }

  return (
    <div className="grading-sessions">
      <div className="grading-sessions-header">
        <h3 className="grading-sessions-title">Grading Sessions</h3>
        <button className="btn btn-primary btn-sm" onClick={() => setShowCreate(true)}>
          + New Session
        </button>
      </div>

      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : sessions.length === 0 ? (
        <p className="empty-text">No grading sessions yet. Create one to get started.</p>
      ) : (
        <div className="table-wrapper">
          <table className="processed-table">
            <thead>
              <tr>
                <th>Session</th>
                <th>Season</th>
                <th>Age Group</th>
                <th>Gender</th>
                <th style={{ textAlign: 'center' }}>Players</th>
                <th>Status</th>
                <th>Date</th>
                <th style={{ width: 80 }}></th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr
                  key={s.id}
                  style={{ cursor: 'pointer' }}
                  onClick={() => openSession(s.id)}
                >
                  <td className="font-medium">{s.name}</td>
                  <td style={{ color: '#6b7280', fontSize: '0.85rem' }}>{s.season_name}</td>
                  <td>{s.age_group}</td>
                  <td>{s.gender}</td>
                  <td style={{ textAlign: 'center' }}>{s.player_count ?? 0}</td>
                  <td><GradingStatusBadge status={s.status} /></td>
                  <td style={{ color: '#6b7280', fontSize: '0.82rem' }}>
                    {s.conducted_at ? formatDate(s.conducted_at) : '—'}
                  </td>
                  <td onClick={(e) => e.stopPropagation()} style={{ textAlign: 'right' }}>
                    {s.status === 'draft' && (
                      <button
                        className="btn btn-ghost btn-sm"
                        style={{ color: '#dc2626' }}
                        onClick={(e) => deleteSession(s.id, e)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {loadingDetail && <p className="loading-text" style={{ marginTop: '1rem' }}>Loading session…</p>}

      {showCreate && (
        <CreateGradingSessionDialog
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}

// ─── All Feedback Tab ─────────────────────────────────────────────────────────

const FB_TYPES = ['technical', 'tactical', 'physical', 'mental', 'general'];
const FB_CONTEXTS = ['game', 'grading', 'training', 'other'];

const FB_TYPE_COLORS = {
  technical: '#1d4ed8',
  tactical:  '#0369a1',
  physical:  '#15803d',
  mental:    '#7c3aed',
  general:   '#6b7280',
};

const FB_CONTEXT_COLORS = {
  game:     '#0891b2',
  grading:  '#7c3aed',
  training: '#15803d',
  other:    '#6b7280',
};

function AllFeedbackTab() {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [contextFilter, setContextFilter] = useState('');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    apiFetch('/api/feedback')
      .then(setFeedback)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading-text">Loading…</p>;
  if (error) return <p className="page-error">{error}</p>;

  const q = search.toLowerCase();
  const filtered = feedback.filter((fb) => {
    const player = `${fb.player_first_name || ''} ${fb.player_last_name || ''}`.toLowerCase();
    const coach = `${fb.coach_first_name || ''} ${fb.coach_last_name || ''}`.toLowerCase();
    const matchSearch = !q || player.includes(q) || coach.includes(q) || fb.title.toLowerCase().includes(q);
    const matchType = !typeFilter || fb.feedback_type === typeFilter;
    const matchContext = !contextFilter || fb.feedback_context === contextFilter;
    return matchSearch && matchType && matchContext;
  });

  return (
    <div className="all-feedback">
      <div className="all-feedback-filters">
        <input
          className="field-input"
          style={{ maxWidth: 280 }}
          placeholder="Search player, coach, or title…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="field-input"
          style={{ maxWidth: 160 }}
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
        >
          <option value="">All types</option>
          {FB_TYPES.map((t) => (
            <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
          ))}
        </select>
        <select
          className="field-input"
          style={{ maxWidth: 160 }}
          value={contextFilter}
          onChange={(e) => setContextFilter(e.target.value)}
        >
          <option value="">All contexts</option>
          {FB_CONTEXTS.map((c) => (
            <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>
          ))}
        </select>
        <span className="all-feedback-count">
          {filtered.length} of {feedback.length} entries
        </span>
      </div>

      {feedback.length === 0 ? (
        <p className="empty-text">No feedback recorded yet.</p>
      ) : filtered.length === 0 ? (
        <p className="empty-text">No feedback matches your filters.</p>
      ) : (
        <div className="table-wrapper">
          <table className="processed-table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Age</th>
                <th>Coach</th>
                <th>Type</th>
                <th>Context</th>
                <th>Rating</th>
                <th>Title</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((fb) => {
                const color = FB_TYPE_COLORS[fb.feedback_type] || '#6b7280';
                const ctxColor = FB_CONTEXT_COLORS[fb.feedback_context] || '#6b7280';
                const isOpen = expanded === fb.id;
                return (
                  <>
                    <tr
                      key={fb.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => setExpanded(isOpen ? null : fb.id)}
                    >
                      <td className="font-medium">
                        {`${fb.player_first_name || ''} ${fb.player_last_name || ''}`.trim() || '—'}
                      </td>
                      <td>{fb.player_age_group || '—'}</td>
                      <td>{`${fb.coach_first_name || ''} ${fb.coach_last_name || ''}`.trim() || '—'}</td>
                      <td>
                        <span style={{
                          background: `${color}18`, color, fontWeight: 600,
                          fontSize: '0.72rem', padding: '2px 8px', borderRadius: 999,
                          textTransform: 'capitalize',
                        }}>
                          {fb.feedback_type}
                        </span>
                      </td>
                      <td>
                        {fb.feedback_context && (
                          <span style={{
                            background: `${ctxColor}18`, color: ctxColor, fontWeight: 600,
                            fontSize: '0.72rem', padding: '2px 8px', borderRadius: 999,
                            textTransform: 'capitalize',
                          }}>
                            {fb.feedback_context}
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#d97706' }}>
                        {fb.rating != null ? '★'.repeat(fb.rating) + '☆'.repeat(5 - fb.rating) : '—'}
                      </td>
                      <td style={{ fontWeight: 600 }}>{fb.title}</td>
                      <td style={{ color: '#6b7280', fontSize: '0.82rem' }}>{formatDate(fb.created_at)}</td>
                    </tr>
                    {isOpen && (
                      <tr key={`${fb.id}-expand`}>
                        <td colSpan={8} style={{ background: '#f9fafb', padding: '0.75rem 1rem', fontSize: '0.875rem', color: '#374151' }}>
                          {fb.content}
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PlayersPage() {
  const { user } = useAuth();
  const roles = parseRoles(user?.roles);
  const isAdmin = roles.includes('admin');
  const canEdit = isAdmin || roles.includes('committee');

  const [activeTab, setActiveTab] = useState('players');
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');
    apiFetch('/api/users')
      .then(setUsers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!canEdit) {
    return (
      <div className="page-container">
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  const players = users.filter((u) => parseRoles(u.roles).includes('player'));

  const tabs = [
    { key: 'players',  label: `Players (${players.length})` },
    { key: 'feedback', label: 'All Feedback' },
    { key: 'grading',  label: 'Grading Sessions' },
  ];

  function handleUserSaved(updated) {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
    setEditingUser(null);
  }

  return (
    <div className="players-page">
      <div className="page-header">
        <h1 className="page-title">Player Management</h1>
      </div>

      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn ${activeTab === t.key ? 'tab-btn--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {error && <p className="page-error">{error}</p>}

      {activeTab === 'grading' ? (
        <div className="tab-panel">
          <GradingSessionsTab />
        </div>
      ) : loading ? (
        <p className="loading-text">Loading…</p>
      ) : (
        <>
          {activeTab === 'players' && (
            <div className="tab-panel">
              <PlayersTab users={users} onEditUser={setEditingUser} />
            </div>
          )}
          {activeTab === 'feedback' && (
            <div className="tab-panel">
              <AllFeedbackTab />
            </div>
          )}
        </>
      )}

      {editingUser && (
        <UserDetailsDialog
          user={editingUser}
          isAdmin={isAdmin}
          onClose={() => setEditingUser(null)}
          onSaved={handleUserSaved}
        />
      )}
    </div>
  );
}
