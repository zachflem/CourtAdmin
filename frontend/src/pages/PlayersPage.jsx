import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './PlayersPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const ALL_ROLES = ['admin', 'committee', 'coach', 'manager', 'player', 'parent'];
const AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];

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

function RoleBadge({ role }) {
  return <span className={`role-badge role-badge--${role}`}>{role}</span>;
}

function StatusBadge({ isActive }) {
  return (
    <span className={`status-badge ${isActive ? 'status-active' : 'status-inactive'}`}>
      {isActive ? 'Active' : 'Inactive'}
    </span>
  );
}

// ─── User Details Dialog ─────────────────────────────────────────────────────

function UserDetailsDialog({ user, isAdmin, onClose, onSaved }) {
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
        <h2 className="dialog-title">Edit User — {fullName(user)}</h2>
        <p className="dialog-subtitle">{user.email}</p>

        <form onSubmit={handleSave}>
          {/* Personal */}
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

          {/* Club details */}
          <fieldset className="form-section">
            <legend className="form-section-title">Club Details</legend>
            <div className="form-row">
              <label className="field-label">
                Age Group
                <select className="field-input" value={form.age_group} onChange={(e) => set('age_group', e.target.value)}>
                  <option value="">— select —</option>
                  {AGE_GROUPS.map((g) => <option key={g}>{g}</option>)}
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

          {/* Clearance */}
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

          {/* Roles & Status */}
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
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Players Tab ─────────────────────────────────────────────────────────────

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

// ─── All Users Tab ───────────────────────────────────────────────────────────

function AllUsersTab({ users, onEditUser, onImportDone }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const fileInputRef = useRef(null);

  const filtered = users.filter((u) => {
    const matchesSearch = (() => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        fullName(u).toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q)
      );
    })();
    const matchesRole = !roleFilter || parseRoles(u.roles).includes(roleFilter);
    return matchesSearch && matchesRole;
  });

  async function handleExport() {
    const res = await fetch(`${API_BASE}/api/users/export`, { credentials: 'include' });
    if (!res.ok) return;
    const blob = await res.blob();
    const date = new Date().toISOString().slice(0, 10);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImportFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setImporting(true);
    try {
      const csv = await file.text();
      const result = await apiFetch('/api/users/import', {
        method: 'POST',
        body: JSON.stringify({ csv }),
      });
      setImportResult(result);
      onImportDone();
    } catch (err) {
      setImportResult({ error: err.message });
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  return (
    <div>
      <div className="toolbar">
        <input
          className="search-input"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="filter-select"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">All roles</option>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
        <span className="toolbar-count">{filtered.length} user{filtered.length !== 1 ? 's' : ''}</span>
        <div className="toolbar-actions">
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>
            Export CSV
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={importing}
          >
            {importing ? 'Importing…' : 'Import CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
        </div>
      </div>

      {importResult && (
        <div className={`import-result ${importResult.error ? 'import-result--error' : 'import-result--success'}`}>
          {importResult.error ? (
            <span>Import failed: {importResult.error}</span>
          ) : (
            <span>
              Import complete — {importResult.created} created, {importResult.updated} updated
              {importResult.errors?.length > 0 && ` (${importResult.errors.length} row errors)`}
            </span>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="empty-text">{users.length === 0 ? 'No users found.' : 'No users match your search.'}</p>
      ) : (
        <div className="table-wrapper">
          <table className="processed-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Roles</th>
                <th>Age Group</th>
                <th>Jersey</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.id} className="table-row--clickable" onClick={() => onEditUser(u)}>
                  <td className="td-name">{fullName(u)}</td>
                  <td>{u.email}</td>
                  <td>
                    <div className="role-badge-list">
                      {parseRoles(u.roles).map((r) => <RoleBadge key={r} role={r} />)}
                      {parseRoles(u.roles).length === 0 && <span className="no-roles">pending</span>}
                    </div>
                  </td>
                  <td>{u.age_group || '—'}</td>
                  <td>{u.jersey_number != null ? `#${u.jersey_number}` : '—'}</td>
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

// ─── Role Requests Tab ───────────────────────────────────────────────────────

function RoleRequestsTab({ onRefresh }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null); // id being acted on

  const fetchRequests = useCallback(() => {
    setLoading(true);
    apiFetch('/api/role-requests')
      .then(setRequests)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleAction(id, status) {
    setProcessing(id);
    try {
      await apiFetch(`/api/role-requests/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status }),
      });
      fetchRequests();
      onRefresh(); // refresh user list so roles show updated
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(null);
    }
  }

  if (loading) return <p className="loading-text">Loading…</p>;
  if (error) return <p className="page-error">{error}</p>;

  return (
    <div>
      {requests.length === 0 ? (
        <p className="empty-text">No pending role requests.</p>
      ) : (
        <div className="role-request-list">
          {requests.map((req) => {
            const currentRoles = parseRoles(req.current_roles);
            const requestedRoles = parseRoles(req.requested_roles);
            const isBusy = processing === req.id;
            return (
              <div key={req.id} className="role-request-card">
                <div className="role-request-header">
                  <div>
                    <p className="role-request-name">{req.first_name} {req.last_name}</p>
                    <p className="role-request-email">{req.email}</p>
                  </div>
                  <span className="role-request-date">{formatDate(req.created_at)}</span>
                </div>

                <div className="role-request-roles">
                  <div className="role-request-roles-group">
                    <span className="role-request-roles-label">Current roles</span>
                    <div className="role-badge-list">
                      {currentRoles.length > 0
                        ? currentRoles.map((r) => <RoleBadge key={r} role={r} />)
                        : <span className="no-roles">none</span>}
                    </div>
                  </div>
                  <div className="role-request-roles-group">
                    <span className="role-request-roles-label">Requesting</span>
                    <div className="role-badge-list">
                      {requestedRoles.map((r) => <RoleBadge key={r} role={r} />)}
                    </div>
                  </div>
                </div>

                {req.justification && (
                  <p className="role-request-justification">"{req.justification}"</p>
                )}

                <div className="role-request-actions">
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={isBusy}
                    onClick={() => handleAction(req.id, 'approved')}
                  >
                    {isBusy ? 'Saving…' : 'Approve'}
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={isBusy}
                    onClick={() => handleAction(req.id, 'rejected')}
                  >
                    Reject
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── EOI Card ─────────────────────────────────────────────────────────────────

function EOICard({ eoi, onProcess }) {
  return (
    <div className="eoi-card">
      <div className="eoi-card-top">
        <div>
          <p className="eoi-name">{eoi.first_name} {eoi.last_name}</p>
          <p className="eoi-meta">{eoi.email}</p>
          <p className="eoi-meta">DOB: {formatDate(eoi.date_of_birth)}</p>
        </div>
        <div className="eoi-card-right">
          <span className="eoi-season-badge">{eoi.season_name ?? eoi.season_interest}</span>
          <p className="eoi-meta">{eoi.gender} · Grade {eoi.grading_level}</p>
          <p className="eoi-meta">{eoi.experience_level}</p>
        </div>
      </div>
      {eoi.clearance_required ? (
        <p className="eoi-clearance-flag">Clearance required</p>
      ) : null}
      <div className="eoi-card-actions">
        <span className="eoi-submitted">Submitted {formatDate(eoi.submitted_at)}</span>
        <button className="btn btn-primary btn-sm" onClick={() => onProcess(eoi)}>
          Process
        </button>
      </div>
    </div>
  );
}

// ─── Processed EOI Row ───────────────────────────────────────────────────────

function ProcessedRow({ eoi }) {
  const statusClass = eoi.status === 'approved' ? 'status-approved' : 'status-rejected';
  return (
    <tr>
      <td>{eoi.first_name} {eoi.last_name}</td>
      <td>{eoi.email}</td>
      <td>{eoi.season_name ?? eoi.season_interest}</td>
      <td><span className={`status-badge ${statusClass}`}>{eoi.status}</span></td>
      <td>{formatDate(eoi.processed_at)}</td>
      <td>
        {eoi.processor_first_name
          ? `${eoi.processor_first_name} ${eoi.processor_last_name}`
          : '—'}
      </td>
    </tr>
  );
}

// ─── EOI Processing Dialog ───────────────────────────────────────────────────

function DetailRow({ label, value, highlight }) {
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      <span className={`detail-value${highlight ? ' detail-value--highlight' : ''}`}>
        {value || '—'}
      </span>
    </div>
  );
}

function EOIProcessDialog({ eoi, onClose, onDone }) {
  const [ageGroup, setAgeGroup] = useState(null);
  const [ageGroupLoading, setAgeGroupLoading] = useState(true);
  const [availableJerseys, setAvailableJerseys] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('approve');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/eoi/${eoi.id}/calculated-age-group`)
      .then((data) => { setAgeGroup(data.age_group); setAgeGroupLoading(false); })
      .catch(() => setAgeGroupLoading(false));
  }, [eoi.id]);

  useEffect(() => {
    if (!ageGroup) return;
    apiFetch(`/api/players/available-jersey-numbers/${ageGroup}`)
      .then((data) => setAvailableJerseys(data.available))
      .catch(() => {});
  }, [ageGroup]);

  useEffect(() => {
    if (!ageGroup) return;
    apiFetch(`/api/teams/by-age-group/${ageGroup}`)
      .then((data) => setAvailableTeams(data))
      .catch(() => {});
  }, [ageGroup]);

  function toggleTeam(teamId) {
    setSelectedTeams((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const body = action === 'approve'
        ? { action: 'approve', jersey_number: Number(jerseyNumber), team_ids: selectedTeams, notes: notes || undefined }
        : { action: 'reject', notes: notes || undefined };
      await apiFetch(`/api/eoi/${eoi.id}`, { method: 'PUT', body: JSON.stringify(body) });
      onDone();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Process Application — {eoi.first_name} {eoi.last_name}</h2>

        <div className="detail-grid">
          <DetailRow label="Email" value={eoi.email} />
          <DetailRow label="Date of Birth" value={formatDate(eoi.date_of_birth)} />
          <DetailRow label="Gender" value={eoi.gender} />
          <DetailRow label="Grading Level" value={eoi.grading_level} />
          <DetailRow label="Experience" value={eoi.experience_level} />
          <DetailRow label="Season" value={eoi.season_name ?? eoi.season_interest} />
          <DetailRow label="Emergency Contact" value={`${eoi.emergency_contact_name} — ${eoi.emergency_contact_phone}`} />
          {eoi.clearance_required ? (
            <>
              <DetailRow label="Clearance" value="Required" highlight />
              <DetailRow label="Previous Club" value={eoi.previous_club_name} />
              <DetailRow label="Previous Team" value={eoi.previous_team_name} />
              <DetailRow label="Previous Coach" value={eoi.previous_coach_name} />
            </>
          ) : null}
          {eoi.parent_guardian_name ? (
            <>
              <DetailRow label="Parent / Guardian" value={eoi.parent_guardian_name} />
              <DetailRow label="Parent Email" value={eoi.parent_guardian_email} />
              <DetailRow label="Parent Phone" value={eoi.parent_guardian_phone} />
            </>
          ) : null}
          {eoi.additional_notes ? <DetailRow label="Notes" value={eoi.additional_notes} /> : null}
        </div>

        <div className="age-group-row">
          <span className="age-group-label">Calculated Age Group:</span>
          {ageGroupLoading
            ? <span className="age-group-loading">Calculating…</span>
            : <span className="age-group-value">{ageGroup ?? 'Unknown'}</span>
          }
        </div>

        <form onSubmit={handleSubmit} className="process-form">
          <div className="action-toggle">
            <button type="button" className={`action-btn ${action === 'approve' ? 'action-btn--active' : ''}`} onClick={() => setAction('approve')}>Approve</button>
            <button type="button" className={`action-btn action-btn--reject ${action === 'reject' ? 'action-btn--active action-btn--active-reject' : ''}`} onClick={() => setAction('reject')}>Reject</button>
          </div>

          {action === 'approve' && (
            <>
              <label className="field-label">
                Jersey Number
                <select className="field-input" value={jerseyNumber} onChange={(e) => setJerseyNumber(e.target.value)} required>
                  <option value="">Select jersey number…</option>
                  {availableJerseys.map((n) => <option key={n} value={n}>#{n}</option>)}
                </select>
                {availableJerseys.length === 0 && ageGroup && (
                  <span className="field-hint">No available jerseys in {ageGroup} or adjacent groups</span>
                )}
              </label>
              {availableTeams.length > 0 && (
                <div className="team-selector">
                  <p className="field-label">Assign to Teams (optional)</p>
                  <div className="team-checkbox-list">
                    {availableTeams.map((team) => (
                      <label key={team.id} className="team-checkbox-row">
                        <input type="checkbox" checked={selectedTeams.includes(team.id)} onChange={() => toggleTeam(team.id)} />
                        <span>{team.name}</span>
                        <span className="team-meta">{team.season_name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          <label className="field-label">
            Notes {action === 'reject' ? '' : '(optional)'}
            <textarea className="field-input field-textarea" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={action === 'reject' ? 'Reason for rejection…' : 'Internal notes…'} rows={3} />
          </label>

          {error && <p className="dialog-error">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className={`btn ${action === 'approve' ? 'btn-primary' : 'btn-danger-solid'}`} disabled={saving || (action === 'approve' && !jerseyNumber)}>
              {saving ? 'Saving…' : action === 'approve' ? 'Approve Player' : 'Reject Application'}
            </button>
          </div>
        </form>
      </div>
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
  const [eois, setEois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingEoi, setProcessingEoi] = useState(null);
  const [editingUser, setEditingUser] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/eoi'),
    ])
      .then(([usersData, eoisData]) => {
        setUsers(usersData);
        setEois(eoisData);
      })
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
  const pendingEois = eois.filter((e) => e.status === 'pending');
  const processedEois = eois.filter((e) => e.status !== 'pending');

  const tabs = [
    { key: 'players',      label: `Players (${players.length})` },
    ...(isAdmin ? [{ key: 'allusers', label: `All Users (${users.length})` }] : []),
    { key: 'rolerequests', label: 'Role Requests' },
    { key: 'inbox',        label: `EOI Inbox (${pendingEois.length})` },
    { key: 'processed',    label: `Processed (${processedEois.length})` },
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

      {loading ? (
        <p className="loading-text">Loading…</p>
      ) : (
        <>
          {activeTab === 'players' && (
            <div className="tab-panel">
              <PlayersTab users={users} onEditUser={setEditingUser} />
            </div>
          )}

          {activeTab === 'allusers' && isAdmin && (
            <div className="tab-panel">
              <AllUsersTab users={users} onEditUser={setEditingUser} onImportDone={fetchData} />
            </div>
          )}

          {activeTab === 'rolerequests' && (
            <div className="tab-panel">
              <RoleRequestsTab onRefresh={fetchData} />
            </div>
          )}

          {activeTab === 'inbox' && (
            <div className="tab-panel">
              {pendingEois.length === 0 ? (
                <p className="empty-text">No pending applications.</p>
              ) : (
                <div className="eoi-list">
                  {pendingEois.map((eoi) => (
                    <EOICard key={eoi.id} eoi={eoi} onProcess={setProcessingEoi} />
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'processed' && (
            <div className="tab-panel">
              {processedEois.length === 0 ? (
                <p className="empty-text">No processed applications yet.</p>
              ) : (
                <div className="table-wrapper">
                  <table className="processed-table">
                    <thead>
                      <tr>
                        <th>Name</th><th>Email</th><th>Season</th>
                        <th>Status</th><th>Processed</th><th>Processed By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {processedEois.map((eoi) => <ProcessedRow key={eoi.id} eoi={eoi} />)}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}

      {processingEoi && (
        <EOIProcessDialog
          eoi={processingEoi}
          onClose={() => setProcessingEoi(null)}
          onDone={() => { setProcessingEoi(null); fetchData(); }}
        />
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
