import { useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
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

// ─── User Details Dialog (with positions) ────────────────────────────────────

function UserDetailsDialog({ user, isAdmin, positions, onClose, onSaved }) {
  const ageGroups = user._ageGroups || [];
  const userPositions = Array.isArray(user.positions) ? user.positions : [];

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
  const [selectedPositions, setSelectedPositions] = useState(userPositions.map((p) => p.id));
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

  function togglePosition(id) {
    setSelectedPositions((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
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
        apiFetch(`/api/users/${user.id}/positions`, { method: 'PUT', body: JSON.stringify({ position_ids: selectedPositions }) }),
      ]);

      const updatedPositions = positions.filter((p) => selectedPositions.includes(p.id));
      onSaved({ ...updatedUser, roles: JSON.stringify(roles), positions: updatedPositions });
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide dialog--tall" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Edit User</h2>
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

          {/* Positions */}
          {isAdmin && positions.length > 0 && (
            <fieldset className="form-section">
              <legend className="form-section-title">Club Positions</legend>
              <div className="roles-grid">
                {positions.map((pos) => (
                  <label key={pos.id} className="role-checkbox">
                    <input
                      type="checkbox"
                      checked={selectedPositions.includes(pos.id)}
                      onChange={() => togglePosition(pos.id)}
                    />
                    <span>{pos.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          )}

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

// ─── Import Modal ─────────────────────────────────────────────────────────────

function ImportModal({ onClose, onDone }) {
  const [importFile, setImportFile] = useState(null);
  const [sendWelcome, setSendWelcome] = useState(true);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef(null);

  async function handleSubmit() {
    if (!importFile) return;
    setImporting(true);
    try {
      const csv = await importFile.text();
      const result = await apiFetch('/api/users/import', {
        method: 'POST',
        body: JSON.stringify({ csv, sendWelcome, customMessage: welcomeMessage }),
      });
      onDone(result);
    } catch (err) {
      onDone({ error: err.message });
    } finally {
      setImporting(false);
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2 className="modal-title">Import Users</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>
        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => fileInputRef.current?.click()}
              style={{ marginBottom: '6px' }}
            >
              Choose CSV file
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={(e) => setImportFile(e.target.files?.[0] || null)}
            />
            {importFile && (
              <p style={{ margin: 0, fontSize: '0.875rem', color: '#555' }}>{importFile.name}</p>
            )}
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={sendWelcome}
              onChange={(e) => setSendWelcome(e.target.checked)}
            />
            <span>Send welcome email to newly added users</span>
          </label>
          {sendWelcome && (
            <div className="form-group" style={{ margin: 0 }}>
              <label className="form-label">Custom message <span style={{ fontWeight: 400, color: '#888' }}>(optional)</span></label>
              <textarea
                className="form-input"
                rows={3}
                placeholder="e.g. You've been registered for the 2025 season."
                value={welcomeMessage}
                onChange={(e) => setWelcomeMessage(e.target.value)}
              />
            </div>
          )}
        </div>
        <div className="modal-footer">
          <button className="btn btn-ghost" onClick={onClose} disabled={importing}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!importFile || importing}
          >
            {importing ? 'Importing…' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── All Users Tab ────────────────────────────────────────────────────────────

function AllUsersTab({ users, positions, onEditUser, onImportDone }) {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importResult, setImportResult] = useState(null);

  const filtered = users.filter((u) => {
    const matchesSearch = (() => {
      if (!search) return true;
      const q = search.toLowerCase();
      return fullName(u).toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
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

  function handleImportDone(result) {
    setImportModalOpen(false);
    setImportResult(result);
    if (!result.error) onImportDone();
  }

  return (
    <div>
      {importModalOpen && (
        <ImportModal
          onClose={() => setImportModalOpen(false)}
          onDone={handleImportDone}
        />
      )}

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
          <button className="btn btn-ghost btn-sm" onClick={handleExport}>Export CSV</button>
          <button className="btn btn-ghost btn-sm" onClick={() => setImportModalOpen(true)}>Import CSV</button>
        </div>
      </div>

      {importResult && (
        <div className={`import-result ${importResult.error ? 'import-result--error' : 'import-result--success'}`}>
          {importResult.error ? (
            <span>Import failed: {importResult.error}</span>
          ) : (
            <span>
              Import complete — {importResult.created} created, {importResult.updated} updated
              {importResult.emailsSent > 0 && `, ${importResult.emailsSent} welcome email${importResult.emailsSent !== 1 ? 's' : ''} sent`}
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
                <th>Positions</th>
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
                  <td>
                    {Array.isArray(u.positions) && u.positions.length > 0 ? (
                      <div className="role-badge-list">
                        {u.positions.map((p) => (
                          <span key={p.id} className="role-badge role-badge--committee" title={p.name}>
                            {p.name}
                          </span>
                        ))}
                      </div>
                    ) : '—'}
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

// ─── Role Requests Tab ────────────────────────────────────────────────────────

function RoleRequestsTab({ onRefresh }) {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processing, setProcessing] = useState(null);

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
      onRefresh();
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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function UsersPage() {
  const { user } = useAuth();
  const roles = parseRoles(user?.roles);
  const isAdmin = roles.includes('admin');
  const canAccess = isAdmin || roles.includes('committee');

  const [activeTab, setActiveTab] = useState('allusers');
  const [users, setUsers] = useState([]);
  const [positions, setPositions] = useState([]);
  const [ageGroups, setAgeGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editingUser, setEditingUser] = useState(null);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch('/api/users'),
      apiFetch('/api/club-positions'),
      apiFetch('/api/club-settings'),
    ])
      .then(([usersData, positionsData, settingsData]) => {
        setUsers(usersData);
        setPositions(positionsData);
        setAgeGroups(settingsData.age_groups || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (!canAccess) {
    return (
      <div className="page-container">
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  const tabs = [
    ...(isAdmin ? [{ key: 'allusers', label: `All Users (${users.length})` }] : []),
    { key: 'rolerequests', label: 'Role Requests' },
  ];

  function handleUserSaved(updated) {
    setUsers((prev) => prev.map((u) => u.id === updated.id ? updated : u));
    setEditingUser(null);
  }

  return (
    <div className="players-page">
      <div className="page-header">
        <h1 className="page-title">User Management</h1>
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
          {activeTab === 'allusers' && isAdmin && (
            <div className="tab-panel">
              <AllUsersTab
                users={users}
                positions={positions}
                onEditUser={(u) => setEditingUser({ ...u, _ageGroups: ageGroups })}
                onImportDone={fetchData}
              />
            </div>
          )}
          {activeTab === 'rolerequests' && (
            <div className="tab-panel">
              <RoleRequestsTab onRefresh={fetchData} />
            </div>
          )}
        </>
      )}

      {editingUser && (
        <UserDetailsDialog
          user={editingUser}
          isAdmin={isAdmin}
          positions={positions}
          onClose={() => setEditingUser(null)}
          onSaved={handleUserSaved}
        />
      )}
    </div>
  );
}
