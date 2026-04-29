import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './DashboardPage.css';

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

function parseRoles(s) {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function formatTime12(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  return `${hour % 12 || 12}:${m}${hour >= 12 ? 'pm' : 'am'}`;
}

function RoleBadge({ role }) {
  return <span className={`role-badge role-badge--${role}`}>{role}</span>;
}

// ─── My Profile Tab ───────────────────────────────────────────────────────────

function MyProfileTab({ userId }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ phone: '', address: '', emergency_contact: '', medical_info: '' });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState('');

  const fetchProfile = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/players/${userId}`)
      .then((data) => {
        setProfile(data);
        setForm({
          phone: data.phone || '',
          address: data.address || '',
          emergency_contact: data.emergency_contact || '',
          medical_info: data.medical_info || '',
        });
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaveError('');
    setSaveSuccess('');
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/players/${userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          phone: form.phone || null,
          address: form.address || null,
          emergency_contact: form.emergency_contact || null,
          medical_info: form.medical_info || null,
        }),
      });
      setProfile(updated);
      setEditing(false);
      setSaveSuccess('Profile updated successfully.');
    } catch (err) {
      setSaveError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="dp-loading">Loading…</p>;
  if (error) return <p className="dp-error">{error}</p>;
  if (!profile) return null;

  const roles = parseRoles(profile.roles);

  return (
    <div className="dp-profile">

      {/* Identity card */}
      <div className="dp-identity-card">
        <div className="dp-identity-name">
          {profile.first_name || profile.last_name
            ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim()
            : '(no name set)'}
        </div>
        <div className="dp-identity-email">{profile.email}</div>
        <div className="dp-role-list">
          {roles.length > 0
            ? roles.map((r) => <RoleBadge key={r} role={r} />)
            : <span className="dp-no-roles">No roles assigned</span>}
        </div>
      </div>

      {/* Club details — read-only */}
      {(profile.age_group || profile.jersey_number != null || profile.grading_level != null || profile.first_year_registered) && (
        <div className="dp-section">
          <h3 className="dp-section-title">Club Details</h3>
          <dl className="dp-field-list">
            {profile.age_group && (
              <div className="dp-field">
                <dt>Age Group</dt>
                <dd>{profile.age_group}</dd>
              </div>
            )}
            {profile.jersey_number != null && (
              <div className="dp-field">
                <dt>Jersey Number</dt>
                <dd>#{profile.jersey_number}</dd>
              </div>
            )}
            {profile.grading_level != null && (
              <div className="dp-field">
                <dt>Grading Level</dt>
                <dd>{profile.grading_level}</dd>
              </div>
            )}
            {profile.gender && (
              <div className="dp-field">
                <dt>Gender</dt>
                <dd>{profile.gender}</dd>
              </div>
            )}
            {profile.date_of_birth && (
              <div className="dp-field">
                <dt>Date of Birth</dt>
                <dd>{formatDate(profile.date_of_birth)}</dd>
              </div>
            )}
            {profile.first_year_registered && (
              <div className="dp-field">
                <dt>First Year Registered</dt>
                <dd>{new Date(profile.first_year_registered).getFullYear()}</dd>
              </div>
            )}
            {profile.clearance_required ? (
              <div className="dp-field">
                <dt>Clearance Status</dt>
                <dd>{profile.clearance_status || 'Pending'}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      )}

      {/* Contact & personal — editable */}
      <div className="dp-section">
        <div className="dp-section-header">
          <h3 className="dp-section-title">Contact &amp; Personal</h3>
          {!editing && (
            <button className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => { setSaveSuccess(''); setEditing(true); }}>
              Edit
            </button>
          )}
        </div>

        {saveSuccess && !editing && (
          <p className="dp-save-success">{saveSuccess}</p>
        )}

        {editing ? (
          <form onSubmit={handleSave} className="dp-edit-form">
            <label className="dp-field-label">
              Phone
              <input className="dp-input" value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </label>
            <label className="dp-field-label">
              Address
              <input className="dp-input" value={form.address} onChange={(e) => set('address', e.target.value)} />
            </label>
            <label className="dp-field-label">
              Emergency Contact
              <input
                className="dp-input"
                placeholder="Name — phone"
                value={form.emergency_contact}
                onChange={(e) => set('emergency_contact', e.target.value)}
              />
            </label>
            <label className="dp-field-label">
              Medical Info
              <textarea
                className="dp-input dp-textarea"
                rows={3}
                value={form.medical_info}
                onChange={(e) => set('medical_info', e.target.value)}
              />
            </label>

            {saveError && <p className="dp-error">{saveError}</p>}

            <div className="dp-form-actions">
              <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="dp-btn dp-btn-primary dp-btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </form>
        ) : (
          <dl className="dp-field-list">
            <div className="dp-field">
              <dt>Phone</dt>
              <dd>{profile.phone || '—'}</dd>
            </div>
            <div className="dp-field">
              <dt>Address</dt>
              <dd>{profile.address || '—'}</dd>
            </div>
            <div className="dp-field">
              <dt>Emergency Contact</dt>
              <dd>{profile.emergency_contact || '—'}</dd>
            </div>
            <div className="dp-field">
              <dt>Medical Info</dt>
              <dd>{profile.medical_info || '—'}</dd>
            </div>
          </dl>
        )}
      </div>
    </div>
  );
}

// ─── My Teams Tab ─────────────────────────────────────────────────────────────

function MyTeamsTab({ userId }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/players/${userId}/teams`)
      .then(setTeams)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="dp-loading">Loading…</p>;
  if (error) return <p className="dp-error">{error}</p>;

  if (teams.length === 0) {
    return <p className="dp-empty">You haven't been added to any teams yet. A club admin can assign you to a team from the Teams management page.</p>;
  }

  return (
    <div className="dp-teams-grid">
      {teams.map((team) => (
        <div key={team.id} className="dp-team-card">
          <div className="dp-team-name">{team.name}</div>
          <div className="dp-team-meta">
            <span className="dp-team-age">{team.age_group}</span>
            <span className="dp-team-season">{team.season_name}</span>
          </div>
          {team.season_is_active ? (
            <span className="dp-active-badge">Active Season</span>
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─── Staff Teams Tab (coaches / managers) ────────────────────────────────────

function StaffTeamsTab({ userId, staffType, emptyLabel }) {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/${staffType}/${userId}/teams`)
      .then(setTeams)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId, staffType]);

  if (loading) return <p className="dp-loading">Loading…</p>;
  if (error) return <p className="dp-error">{error}</p>;

  if (teams.length === 0) {
    return <p className="dp-empty">You are not assigned to any teams as a {emptyLabel} yet.</p>;
  }

  return (
    <div className="dp-teams-grid">
      {teams.map((team) => (
        <div key={team.id} className="dp-team-card">
          <div className="dp-team-name">{team.name}</div>
          <div className="dp-team-meta">
            <span className="dp-team-age">{team.age_group}</span>
            <span className="dp-team-season">{team.season_name}</span>
          </div>
          <div className="dp-team-player-count">{team.player_count} player{team.player_count !== 1 ? 's' : ''}</div>
          {team.season_is_active ? (
            <span className="dp-active-badge">Active Season</span>
          ) : null}
          {team.training && team.training.length > 0 && (
            <div className="dp-team-training">
              <div className="dp-training-label">Training</div>
              <div className="dp-training-venue">{team.training[0].venue_name}</div>
              {team.training[0].venue_address && (
                <div className="dp-training-address">{team.training[0].venue_address}</div>
              )}
              <div className="dp-training-slots">
                {team.training.map((s, i) => (
                  <span key={i} className="dp-training-slot">
                    {s.day_of_week} {formatTime12(s.start_time)}–{formatTime12(s.end_time)}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// ─── Staff Players Tab (coaches / managers) ───────────────────────────────────

function StaffPlayersTab({ userId, staffType, emptyLabel }) {
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  useEffect(() => {
    apiFetch(`/api/${staffType}/${userId}/players`)
      .then(setPlayers)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId, staffType]);

  if (loading) return <p className="dp-loading">Loading…</p>;
  if (error) return <p className="dp-error">{error}</p>;

  if (players.length === 0) {
    return <p className="dp-empty">No players found on your {emptyLabel} teams.</p>;
  }

  const q = search.toLowerCase();
  const filtered = q
    ? players.filter((p) =>
        `${p.first_name} ${p.last_name}`.toLowerCase().includes(q) ||
        (p.email || '').toLowerCase().includes(q)
      )
    : players;

  return (
    <div className="dp-staff-players">
      <input
        className="dp-input dp-search-input"
        placeholder="Search players…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />
      {filtered.length === 0 ? (
        <p className="dp-empty">No players match your search.</p>
      ) : (
        <table className="dp-players-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Age Group</th>
              <th>#</th>
              <th>Email</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p) => (
              <tr key={p.id}>
                <td className="dp-player-name">
                  {p.first_name || p.last_name
                    ? `${p.first_name || ''} ${p.last_name || ''}`.trim()
                    : '(no name)'}
                </td>
                <td>{p.age_group || '—'}</td>
                <td>{p.jersey_number != null ? `#${p.jersey_number}` : '—'}</td>
                <td className="dp-player-email">{p.email}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

// ─── Shared: feedback card ────────────────────────────────────────────────────

const TYPE_COLORS = {
  technical: '#1d4ed8',
  tactical:  '#0369a1',
  physical:  '#15803d',
  mental:    '#7c3aed',
  general:   '#6b7280',
};

function FeedbackCard({ fb, showPlayer = false }) {
  const color = TYPE_COLORS[fb.feedback_type] || '#6b7280';
  return (
    <div className="dp-fb-card">
      <div className="dp-fb-card-header">
        <span className="dp-fb-title">{fb.title}</span>
        <span className="dp-fb-type" style={{ background: `${color}18`, color }}>
          {fb.feedback_type}
        </span>
      </div>
      {showPlayer && (
        <div className="dp-fb-player">
          {fb.player_first_name || fb.player_last_name
            ? `${fb.player_first_name || ''} ${fb.player_last_name || ''}`.trim()
            : '—'}{fb.player_age_group ? ` · ${fb.player_age_group}` : ''}
        </div>
      )}
      <div className="dp-fb-meta">
        {!showPlayer && (
          <span>
            Coach: {fb.coach_first_name || fb.coach_last_name
              ? `${fb.coach_first_name || ''} ${fb.coach_last_name || ''}`.trim()
              : '—'}
          </span>
        )}
        {fb.rating != null && (
          <span className="dp-fb-rating">
            {'★'.repeat(fb.rating)}{'☆'.repeat(5 - fb.rating)}
          </span>
        )}
        <span>{formatDate(fb.created_at)}</span>
      </div>
      <p className="dp-fb-content">{fb.content}</p>
    </div>
  );
}

// ─── My Feedback Tab (player) ─────────────────────────────────────────────────

function MyFeedbackTab({ userId }) {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/players/${userId}/feedback`)
      .then(setFeedback)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="dp-loading">Loading…</p>;
  if (error) return <p className="dp-error">{error}</p>;
  if (feedback.length === 0) {
    return <p className="dp-empty">No feedback received yet.</p>;
  }

  return (
    <div className="dp-fb-list">
      {feedback.map((fb) => <FeedbackCard key={fb.id} fb={fb} />)}
    </div>
  );
}

// ─── Coach Feedback Tab ───────────────────────────────────────────────────────

const FEEDBACK_TYPES = ['technical', 'tactical', 'physical', 'mental', 'general'];

function CreateFeedbackDialog({ coachId, onClose, onCreated }) {
  const [players, setPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [form, setForm] = useState({
    player_id: '',
    title: '',
    feedback_type: 'general',
    rating: '',
    content: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/coaches/${coachId}/players`)
      .then(setPlayers)
      .catch(() => {})
      .finally(() => setLoadingPlayers(false));
  }, [coachId]);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (!form.player_id) { setError('Select a player.'); return; }
    if (!form.title.trim()) { setError('Title is required.'); return; }
    if (!form.content.trim()) { setError('Content is required.'); return; }
    setSaving(true);
    try {
      await apiFetch(`/api/players/${form.player_id}/feedback`, {
        method: 'POST',
        body: JSON.stringify({
          title: form.title.trim(),
          content: form.content.trim(),
          feedback_type: form.feedback_type,
          rating: form.rating ? Number(form.rating) : null,
        }),
      });
      onCreated();
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Create Feedback</h2>

        {loadingPlayers ? (
          <p className="dp-loading">Loading players…</p>
        ) : players.length === 0 ? (
          <p className="dp-empty">No players on your teams yet.</p>
        ) : (
          <form onSubmit={handleSubmit} className="dp-edit-form">
            <label className="dp-field-label">
              Player
              <select
                className="dp-input"
                value={form.player_id}
                onChange={(e) => set('player_id', e.target.value)}
                required
              >
                <option value="">— select player —</option>
                {players.map((p) => (
                  <option key={p.id} value={p.id}>
                    {`${p.first_name || ''} ${p.last_name || ''}`.trim() || p.email}
                    {p.age_group ? ` (${p.age_group})` : ''}
                    {p.jersey_number != null ? ` #${p.jersey_number}` : ''}
                  </option>
                ))}
              </select>
            </label>

            <label className="dp-field-label">
              Title
              <input
                className="dp-input"
                value={form.title}
                onChange={(e) => set('title', e.target.value)}
                placeholder="e.g. Session feedback – 3 April"
                required
              />
            </label>

            <div className="dp-fb-form-row">
              <label className="dp-field-label" style={{ flex: 1 }}>
                Type
                <select
                  className="dp-input"
                  value={form.feedback_type}
                  onChange={(e) => set('feedback_type', e.target.value)}
                >
                  {FEEDBACK_TYPES.map((t) => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
              </label>

              <label className="dp-field-label" style={{ flex: 1 }}>
                Rating (optional)
                <select
                  className="dp-input"
                  value={form.rating}
                  onChange={(e) => set('rating', e.target.value)}
                >
                  <option value="">— no rating —</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{'★'.repeat(n)} ({n})</option>
                  ))}
                </select>
              </label>
            </div>

            <label className="dp-field-label">
              Feedback
              <textarea
                className="dp-input dp-textarea"
                rows={5}
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                placeholder="Enter your feedback…"
                required
              />
            </label>

            {error && <p className="dp-error">{error}</p>}

            <div className="dp-form-actions">
              <button type="button" className="dp-btn dp-btn-ghost dp-btn-sm" onClick={onClose} disabled={saving}>
                Cancel
              </button>
              <button type="submit" className="dp-btn dp-btn-primary dp-btn-sm" disabled={saving}>
                {saving ? 'Saving…' : 'Submit Feedback'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

function CoachFeedbackTab({ userId }) {
  const [feedback, setFeedback] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const fetchFeedback = useCallback(() => {
    setLoading(true);
    apiFetch('/api/feedback/my-teams')
      .then(setFeedback)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchFeedback(); }, [fetchFeedback]);

  const q = search.toLowerCase();
  const filtered = feedback.filter((fb) => {
    const playerName = `${fb.player_first_name || ''} ${fb.player_last_name || ''}`.toLowerCase();
    const matchSearch = !q || playerName.includes(q) || fb.title.toLowerCase().includes(q);
    const matchType = !typeFilter || fb.feedback_type === typeFilter;
    return matchSearch && matchType;
  });

  return (
    <div className="dp-staff-players">
      <div className="dp-fb-toolbar">
        <div className="dp-fb-filters">
          <input
            className="dp-input dp-search-input"
            placeholder="Search player or title…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            className="dp-input"
            style={{ maxWidth: 160 }}
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
          >
            <option value="">All types</option>
            {FEEDBACK_TYPES.map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
        <button className="dp-btn dp-btn-primary dp-btn-sm" onClick={() => setShowCreate(true)}>
          + Create Feedback
        </button>
      </div>

      {loading ? (
        <p className="dp-loading">Loading…</p>
      ) : error ? (
        <p className="dp-error">{error}</p>
      ) : feedback.length === 0 ? (
        <p className="dp-empty">No feedback for your teams yet. Use the button above to create the first entry.</p>
      ) : filtered.length === 0 ? (
        <p className="dp-empty">No feedback matches your filters.</p>
      ) : (
        <div className="dp-fb-list">
          {filtered.map((fb) => <FeedbackCard key={fb.id} fb={fb} showPlayer />)}
        </div>
      )}

      {showCreate && (
        <CreateFeedbackDialog
          coachId={userId}
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchFeedback(); }}
        />
      )}
    </div>
  );
}

// ─── Parent Feedback Tab ──────────────────────────────────────────────────────

function ParentFeedbackTab({ userId }) {
  const [children, setChildren] = useState([]);
  const [feedbackMap, setFeedbackMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    apiFetch(`/api/parents/${userId}/children`)
      .then(async (kids) => {
        setChildren(kids);
        if (kids.length === 0) return;
        const entries = await Promise.all(
          kids.map((k) =>
            apiFetch(`/api/players/${k.id}/feedback`)
              .then((fb) => [k.id, fb])
              .catch(() => [k.id, []])
          )
        );
        setFeedbackMap(Object.fromEntries(entries));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <p className="dp-loading">Loading…</p>;
  if (error) return <p className="dp-error">{error}</p>;
  if (children.length === 0) {
    return <p className="dp-empty">No linked child accounts found.</p>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {children.map((child) => {
        const fb = feedbackMap[child.id] || [];
        const name = `${child.first_name || ''} ${child.last_name || ''}`.trim() || child.email;
        return (
          <div key={child.id} className="dp-section">
            <h3 className="dp-section-title">
              {name}{child.age_group ? ` · ${child.age_group}` : ''}
              {child.jersey_number != null ? ` · #${child.jersey_number}` : ''}
            </h3>
            {fb.length === 0 ? (
              <p className="dp-empty" style={{ paddingTop: 0 }}>No feedback yet.</p>
            ) : (
              <div className="dp-fb-list">
                {fb.map((f) => <FeedbackCard key={f.id} fb={f} />)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Role Requests Tab ────────────────────────────────────────────────────────

const STATUS_COLOR = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };

function RoleRequestsTab({ user }) {
  const { realUser, mockRole, setMockRole } = useAuth();
  const isRealAdmin = parseRoles(realUser?.roles).includes('admin');
  const currentRoles = parseRoles(user.roles);
  const available = ALL_ROLES.filter((r) => !currentRoles.includes(r));

  const [myRequests, setMyRequests] = useState([]);
  const [selected, setSelected] = useState([]);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMyRequests = useCallback(() => {
    apiFetch('/api/role-requests/my')
      .then(setMyRequests)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchMyRequests(); }, [fetchMyRequests]);

  const pendingRoles = myRequests
    .filter((r) => r.status === 'pending')
    .flatMap((r) => parseRoles(r.requested_roles));

  const requestable = available.filter((r) => !pendingRoles.includes(r));

  function toggleRole(role) {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.length === 0) return;
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await apiFetch('/api/role-requests', {
        method: 'POST',
        body: JSON.stringify({ roles: selected, justification: justification || undefined }),
      });
      setSelected([]);
      setJustification('');
      setSuccess('Request submitted successfully.');
      fetchMyRequests();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="dp-role-section">
      <div className="dp-section">
        <h3 className="dp-section-title">Your Current Roles</h3>
        <div className="dp-role-list" style={{ marginTop: '0.5rem' }}>
          {currentRoles.length > 0
            ? currentRoles.map((r) => <RoleBadge key={r} role={r} />)
            : <span className="dp-no-roles">No roles assigned yet.</span>}
        </div>
        {isRealAdmin && (
          <div className="dp-mock-role">
            <label className="dp-mock-role-label" htmlFor="mock-role-select">Preview as:</label>
            <select
              id="mock-role-select"
              className="dp-mock-role-select"
              value={mockRole || ''}
              onChange={(e) => setMockRole(e.target.value || null)}
            >
              <option value="">— your actual roles —</option>
              {ALL_ROLES.filter((r) => r !== 'admin').map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="dp-section">
        <h3 className="dp-section-title">Request Additional Roles</h3>
        {requestable.length > 0 ? (
          <form onSubmit={handleSubmit} className="dp-role-form">
            <div className="dp-role-checkboxes">
              {requestable.map((role) => (
                <label key={role} className="dp-role-checkbox">
                  <input
                    type="checkbox"
                    checked={selected.includes(role)}
                    onChange={() => toggleRole(role)}
                  />
                  <span>{role}</span>
                </label>
              ))}
            </div>

            <textarea
              className="dp-input dp-textarea"
              placeholder="Justification (optional)"
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={3}
            />

            {error && <p className="dp-error">{error}</p>}
            {success && <p className="dp-save-success">{success}</p>}

            <div className="dp-form-actions">
              <button
                type="submit"
                className="dp-btn dp-btn-primary dp-btn-sm"
                disabled={submitting || selected.length === 0}
              >
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </form>
        ) : (
          <p className="dp-empty" style={{ paddingTop: '0.5rem' }}>
            {available.length === 0
              ? 'You have all available roles.'
              : 'You already have pending requests for all available roles.'}
          </p>
        )}
      </div>

      {myRequests.length > 0 && (
        <div className="dp-section">
          <h3 className="dp-section-title">My Requests</h3>
          <div className="dp-request-list">
            {myRequests.map((req) => (
              <div key={req.id} className="dp-request-row">
                <div className="dp-role-list">
                  {parseRoles(req.requested_roles).map((r) => <RoleBadge key={r} role={r} />)}
                </div>
                <span
                  className="dp-request-status"
                  style={{ color: STATUS_COLOR[req.status] ?? '#6b7280' }}
                >
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── DashboardPage ────────────────────────────────────────────────────────────

export function DashboardPage() {
  const { user } = useAuth();
  const roles = parseRoles(user?.roles);
  const isPlayer = roles.includes('player');
  const isCoach = roles.includes('coach');
  const isManager = roles.includes('manager');
  const isParent = roles.includes('parent');

  const tabs = [
    { key: 'profile', label: 'My Profile' },
    ...(isPlayer ? [
      { key: 'teams', label: 'My Teams' },
      { key: 'my-feedback', label: 'My Feedback' },
    ] : []),
    ...(isCoach ? [
      { key: 'coach-teams', label: 'Teams I Coach' },
      { key: 'coach-players', label: 'My Players' },
      { key: 'coach-feedback', label: 'Feedback' },
    ] : []),
    ...(isManager ? [
      { key: 'manager-teams', label: 'Teams I Manage' },
      { key: 'manager-players', label: 'Managed Players' },
    ] : []),
    ...(isParent ? [{ key: 'parent-feedback', label: "Children's Feedback" }] : []),
    { key: 'roles', label: 'Role Requests' },
  ];

  const [activeTab, setActiveTab] = useState('profile');

  return (
    <div className="dp-page">
      <div className="dp-page-header">
        <h1 className="dp-page-title">Dashboard</h1>
      </div>

      <div className="dp-tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`dp-tab-btn${activeTab === t.key ? ' dp-tab-btn--active' : ''}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="dp-tab-panel">
        {activeTab === 'profile' && <MyProfileTab userId={user.id} />}
        {activeTab === 'teams' && isPlayer && <MyTeamsTab userId={user.id} />}
        {activeTab === 'my-feedback' && isPlayer && <MyFeedbackTab userId={user.id} />}
        {activeTab === 'coach-teams' && isCoach && (
          <StaffTeamsTab userId={user.id} staffType="coaches" emptyLabel="coach" />
        )}
        {activeTab === 'coach-players' && isCoach && (
          <StaffPlayersTab userId={user.id} staffType="coaches" emptyLabel="coached" />
        )}
        {activeTab === 'coach-feedback' && isCoach && <CoachFeedbackTab userId={user.id} />}
        {activeTab === 'manager-teams' && isManager && (
          <StaffTeamsTab userId={user.id} staffType="managers" emptyLabel="manager" />
        )}
        {activeTab === 'manager-players' && isManager && (
          <StaffPlayersTab userId={user.id} staffType="managers" emptyLabel="managed" />
        )}
        {activeTab === 'parent-feedback' && isParent && <ParentFeedbackTab userId={user.id} />}
        {activeTab === 'roles' && <RoleRequestsTab user={user} />}
      </div>
    </div>
  );
}
