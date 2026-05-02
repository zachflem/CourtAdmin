import { useEffect, useState, useCallback, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './TeamsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fullName(u) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
}

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

function PencilIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

// ─── Season Dialog ────────────────────────────────────────────────────────────

const EMPTY_SEASON_FORM = {
  name: '', start_date: '', end_date: '', age_cutoff_date: '',
  eoi_start_date: '', eoi_end_date: '', is_active: true, is_closed: false,
};

function SeasonDialog({ season, onClose, onSaved }) {
  const isEdit = Boolean(season);
  const [form, setForm] = useState(
    isEdit ? {
      name: season.name,
      start_date: season.start_date.slice(0, 10),
      end_date: season.end_date.slice(0, 10),
      age_cutoff_date: season.age_cutoff_date ? season.age_cutoff_date.slice(0, 10) : '',
      eoi_start_date: season.eoi_start_date ? season.eoi_start_date.slice(0, 10) : '',
      eoi_end_date: season.eoi_end_date ? season.eoi_end_date.slice(0, 10) : '',
      is_active: Boolean(season.is_active),
      is_closed: Boolean(season.is_closed),
    } : EMPTY_SEASON_FORM
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
      const url = isEdit ? `${API_BASE}/api/seasons/${season.id}` : `${API_BASE}/api/seasons`;
      const res = await fetch(url, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          eoi_start_date: form.eoi_start_date || null,
          eoi_end_date: form.eoi_end_date || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      onSaved(await res.json(), isEdit);
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
              autoFocus
            />
          </label>

          <div className="field-row">
            <label className="field-label">
              Start Date
              <input className="field-input" type="date" value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)} required />
            </label>
            <label className="field-label">
              End Date
              <input className="field-input" type="date" value={form.end_date}
                onChange={(e) => set('end_date', e.target.value)} required />
            </label>
          </div>

          <label className="field-label">
            Age Cutoff Date
            <span className="field-hint">Players' ages are calculated as of this date</span>
            <input className="field-input" type="date" value={form.age_cutoff_date}
              onChange={(e) => set('age_cutoff_date', e.target.value)} />
          </label>

          <div className="field-row">
            <label className="field-label">
              EOI Open Date
              <span className="field-hint">When registrations open (optional)</span>
              <input className="field-input" type="date" value={form.eoi_start_date}
                onChange={(e) => set('eoi_start_date', e.target.value)} />
            </label>
            <label className="field-label">
              EOI Close Date
              <span className="field-hint">When registrations close (optional)</span>
              <input className="field-input" type="date" value={form.eoi_end_date}
                onChange={(e) => set('eoi_end_date', e.target.value)} />
            </label>
          </div>

          {isEdit && (
            <div className="season-status-toggles">
              <label className="season-toggle-label">
                <input type="checkbox" checked={form.is_active}
                  onChange={(e) => set('is_active', e.target.checked)} />
                Active season
              </label>
              <label className="season-toggle-label">
                <input type="checkbox" checked={form.is_closed}
                  onChange={(e) => set('is_closed', e.target.checked)} />
                Closed to new registrations
              </label>
            </div>
          )}

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

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

// ─── Create Team Dialog ───────────────────────────────────────────────────────

function CreateTeamDialog({ seasons, preselectedSeasonId, onClose, onCreated }) {
  const { settings: clubSettings } = useClub();
  const ageGroups = clubSettings.age_groups || [];
  const divisions = clubSettings.divisions || [];
  const [form, setForm] = useState({
    name: '',
    season_id: preselectedSeasonId || (seasons[0]?.id ?? ''),
    age_group: ageGroups[0] ?? '',
    division: divisions[0] ?? '',
    play_day: '',
  });
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
      const team = await apiFetch('/api/teams', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onCreated(team);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Create Team</h2>
        <form onSubmit={handleSubmit} className="dialog-form">
          <label className="field-label">
            Team Name
            <input
              className="field-input"
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              placeholder="e.g. Red Hawks"
              autoFocus
            />
          </label>

          <label className="field-label">
            Season
            <select
              className="field-input"
              value={form.season_id}
              onChange={(e) => set('season_id', e.target.value)}
              required
            >
              {seasons.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </label>

          <div className="field-row">
            <label className="field-label">
              Age Group
              <select
                className="field-input"
                value={form.age_group}
                onChange={(e) => set('age_group', e.target.value)}
                required
              >
                {ageGroups.map((g) => (
                  <option key={g} value={g}>{g}</option>
                ))}
              </select>
            </label>

            <label className="field-label">
              Division
              <select
                className="field-input"
                value={form.division}
                onChange={(e) => set('division', e.target.value)}
                required
              >
                {divisions.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="field-label">
            Game Day
            <span className="field-hint">Day of week association games are played (optional)</span>
            <select
              className="field-input"
              value={form.play_day}
              onChange={(e) => set('play_day', e.target.value)}
            >
              <option value="">— Not set —</option>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </label>

          {error && <p className="dialog-error">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Creating…' : 'Create Team'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Member Tab ───────────────────────────────────────────────────────────────

function MemberTab({ members, allUsers, onAdd, onRemove, removing }) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(null);

  const memberIds = new Set(members.map((m) => m.id));

  const filtered = allUsers.filter((u) => {
    if (memberIds.has(u.id)) return false;
    if (!search.trim()) return false;
    const q = search.toLowerCase();
    return (
      fullName(u).toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q)
    );
  });

  async function handleAdd(user) {
    setAdding(user.id);
    try {
      await onAdd(user.id);
    } finally {
      setAdding(null);
      setSearch('');
    }
  }

  return (
    <div className="member-tab">
      {members.length === 0 ? (
        <p className="member-empty">No members yet.</p>
      ) : (
        <ul className="member-list">
          {members.map((m) => (
            <li key={m.id} className="member-row">
              <span className="member-name">{fullName(m)}</span>
              <span className="member-email">{m.email}</span>
              {m.jersey_number != null && (
                <span className="member-badge">#{m.jersey_number}</span>
              )}
              <button
                className="btn btn-ghost btn-sm btn-danger"
                onClick={() => onRemove(m.id)}
                disabled={removing === m.id}
              >
                {removing === m.id ? '…' : 'Remove'}
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="add-member-section">
        <p className="add-member-label">Add member</p>
        <input
          className="field-input"
          type="text"
          placeholder="Search by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {filtered.length > 0 && (
          <ul className="add-member-results">
            {filtered.slice(0, 8).map((u) => (
              <li key={u.id} className="add-member-row">
                <span className="member-name">{fullName(u)}</span>
                <span className="member-email">{u.email}</span>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => handleAdd(u)}
                  disabled={adding === u.id}
                >
                  {adding === u.id ? '…' : 'Add'}
                </button>
              </li>
            ))}
          </ul>
        )}
        {search.trim() && filtered.length === 0 && (
          <p className="add-member-none">No matching users.</p>
        )}
      </div>
    </div>
  );
}

// ─── Team Management Dialog ───────────────────────────────────────────────────

function TeamManagementDialog({ team: initialTeam, allUsers, onClose, onUpdated }) {
  const { settings: clubSettings } = useClub();
  const ageGroups = clubSettings.age_groups || [];
  const divisions = clubSettings.divisions || [];
  const [team, setTeam] = useState(initialTeam);
  const [activeTab, setActiveTab] = useState('players');
  const [editName, setEditName] = useState(initialTeam.name);
  const [editAgeGroup, setEditAgeGroup] = useState(initialTeam.age_group);
  const [editDivision, setEditDivision] = useState(initialTeam.division ?? divisions[0] ?? '');
  const [editPlayDay, setEditPlayDay] = useState(initialTeam.play_day ?? '');
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [removing, setRemoving] = useState(null);

  useEffect(() => {
    apiFetch(`/api/teams/${initialTeam.id}`)
      .then(setTeam)
      .catch(() => {});
  }, [initialTeam.id]);

  async function saveMeta() {
    if (
      editName === team.name &&
      editAgeGroup === team.age_group &&
      editDivision === (team.division ?? divisions[0] ?? '') &&
      editPlayDay === (team.play_day ?? '')
    ) return;
    setMetaError('');
    setSavingMeta(true);
    try {
      const updated = await apiFetch(`/api/teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          name: editName,
          age_group: editAgeGroup,
          division: editDivision,
          play_day: editPlayDay || null,
        }),
      });
      setTeam((t) => ({ ...t, ...updated }));
      onUpdated(updated);
    } catch (err) {
      setMetaError(err.message);
    } finally {
      setSavingMeta(false);
    }
  }

  async function handleAdd(role, userId) {
    const key = `add_${role}s`;
    const updated = await apiFetch(`/api/teams/${team.id}`, {
      method: 'PUT',
      body: JSON.stringify({ [key]: [userId] }),
    });
    const full = await apiFetch(`/api/teams/${team.id}`);
    setTeam(full);
    onUpdated(updated);
  }

  async function handleRemove(role, userId) {
    setRemoving(userId);
    try {
      const key = `remove_${role}s`;
      const updated = await apiFetch(`/api/teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify({ [key]: [userId] }),
      });
      const full = await apiFetch(`/api/teams/${team.id}`);
      setTeam(full);
      onUpdated(updated);
    } finally {
      setRemoving(null);
    }
  }

  const tabs = [
    { key: 'players',  label: `Players (${team.players?.length ?? 0})` },
    { key: 'coaches',  label: `Coaches (${team.coaches?.length ?? 0})` },
    { key: 'managers', label: `Managers (${team.managers?.length ?? 0})` },
  ];

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="manage-header">
          <div className="manage-name-row">
            <input
              className="field-input manage-name-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onBlur={saveMeta}
            />
            <select
              className="field-input manage-agegroup-select"
              value={editAgeGroup}
              onChange={(e) => setEditAgeGroup(e.target.value)}
              onBlur={saveMeta}
            >
              {ageGroups.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select
              className="field-input manage-division-select"
              value={editDivision}
              onChange={(e) => setEditDivision(e.target.value)}
              onBlur={saveMeta}
            >
              {divisions.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <select
              className="field-input manage-playday-select"
              value={editPlayDay}
              onChange={(e) => setEditPlayDay(e.target.value)}
              onBlur={saveMeta}
              title="Game day"
            >
              <option value="">Game day…</option>
              {DAYS_OF_WEEK.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            {savingMeta && <span className="meta-saving">Saving…</span>}
          </div>
          {metaError && <p className="dialog-error">{metaError}</p>}
          <p className="manage-season">{team.season_name}</p>
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

        <div className="tab-content">
          {activeTab === 'players' && (
            <MemberTab
              members={team.players ?? []}
              allUsers={allUsers}
              onAdd={(uid) => handleAdd('player', uid)}
              onRemove={(uid) => handleRemove('player', uid)}
              removing={removing}
            />
          )}
          {activeTab === 'coaches' && (
            <MemberTab
              members={team.coaches ?? []}
              allUsers={allUsers}
              onAdd={(uid) => handleAdd('coach', uid)}
              onRemove={(uid) => handleRemove('coach', uid)}
              removing={removing}
            />
          )}
          {activeTab === 'managers' && (
            <MemberTab
              members={team.managers ?? []}
              allUsers={allUsers}
              onAdd={(uid) => handleAdd('manager', uid)}
              onRemove={(uid) => handleRemove('manager', uid)}
              removing={removing}
            />
          )}
        </div>

        <div className="dialog-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Team Card ────────────────────────────────────────────────────────────────

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
}

function TeamCard({ team, availableTimeslots, onManage }) {
  const hasTraining = (team.training_count ?? 0) > 0;
  const suggestions = !hasTraining ? (availableTimeslots ?? []).slice(0, 4) : [];

  return (
    <div className="team-card">
      <div className="team-card-header">
        <span className="team-age-badge">{team.age_group}</span>
        {team.division && <span className="team-division-badge">{team.division}</span>}
        {team.play_day && <span className="team-playday-badge">{team.play_day}</span>}
        <h3 className="team-name">{team.name}</h3>
      </div>
      <div className="team-counts">
        <span>Players: <strong>{team.player_count}</strong></span>
        <span>Coaches: <strong>{team.coach_count}</strong></span>
        <span>Managers: <strong>{team.manager_count}</strong></span>
      </div>

      {!hasTraining && suggestions.length > 0 && (
        <div className="team-training-suggestions">
          <p className="team-training-label">No training slot assigned — available slots:</p>
          <div className="team-suggestion-pills">
            {suggestions.map((slot) => (
              <span key={slot.id} className="suggestion-pill">
                {slot.venue_name}{slot.court_name ? ` · ${slot.court_name}` : ''} · {slot.day_of_week} {formatTime(slot.start_time)}
              </span>
            ))}
            {(availableTimeslots ?? []).length > 4 && (
              <span className="suggestion-pill suggestion-pill--more">
                +{(availableTimeslots ?? []).length - 4} more
              </span>
            )}
          </div>
        </div>
      )}
      {!hasTraining && suggestions.length === 0 && (availableTimeslots ?? []).length === 0 && (
        <p className="team-no-training">No training slot assigned</p>
      )}

      <div className="team-card-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => onManage(team)}>
          Manage
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function TeamsPage() {
  const { user } = useAuth();
  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const canEdit = roles.includes('admin') || roles.includes('committee');

  const [seasons, setSeasons] = useState([]);
  const [selectedSeasonId, setSelectedSeasonId] = useState(null);
  const [teams, setTeams] = useState([]);
  const [allUsers, setAllUsers] = useState([]);
  const [availableTimeslots, setAvailableTimeslots] = useState([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [managingTeam, setManagingTeam] = useState(null);
  const [showCreateSeason, setShowCreateSeason] = useState(false);
  const [editSeason, setEditSeason] = useState(null);

  // Load seasons + users + available timeslots once
  useEffect(() => {
    Promise.all([
      apiFetch('/api/seasons'),
      apiFetch('/api/users'),
      apiFetch('/api/venues/available-timeslots'),
    ])
      .then(([s, u, slots]) => {
        setSeasons(s);
        setAllUsers(u);
        setAvailableTimeslots(slots);
        // Prefer the first active season, fall back to first overall
        const preferred = s.find((x) => x.is_active) || s[0];
        if (preferred) setSelectedSeasonId(preferred.id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSeasons(false));
  }, []);

  // Active seasons newest-first; inactive seasons chronologically
  const { activeSeasons, inactiveSeasons } = useMemo(() => ({
    activeSeasons: seasons
      .filter((s) => s.is_active)
      .sort((a, b) => b.start_date.localeCompare(a.start_date)),
    inactiveSeasons: seasons
      .filter((s) => !s.is_active)
      .sort((a, b) => a.start_date.localeCompare(b.start_date)),
  }), [seasons]);

  // Load teams for selected season
  const fetchTeams = useCallback((seasonId) => {
    if (!seasonId) return;
    setLoadingTeams(true);
    apiFetch(`/api/teams?season_id=${seasonId}`)
      .then(setTeams)
      .catch((err) => setError(err.message))
      .finally(() => setLoadingTeams(false));
  }, []);

  useEffect(() => {
    if (selectedSeasonId) fetchTeams(selectedSeasonId);
  }, [selectedSeasonId, fetchTeams]);

  function handleSeasonSaved(saved, isEdit) {
    if (isEdit) {
      setSeasons((prev) => prev.map((s) => (s.id === saved.id ? saved : s)));
    } else {
      setSeasons((prev) => [saved, ...prev]);
      setSelectedSeasonId(saved.id);
    }
    setShowCreateSeason(false);
    setEditSeason(null);
  }

  function handleCreated(team) {
    setShowCreate(false);
    if (team.season_id === selectedSeasonId) {
      setTeams((prev) => [...prev, team]);
    } else {
      setSelectedSeasonId(team.season_id);
    }
  }

  function handleUpdated(updated) {
    setTeams((prev) =>
      prev.map((t) => (t.id === updated.id ? { ...t, ...updated } : t))
    );
  }

  if (!canEdit) {
    return (
      <div className="page-container">
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  const selectedSeason = seasons.find((s) => s.id === selectedSeasonId);
  const teamsForSeason = teams.filter((t) => t.season_id === selectedSeasonId);

  function SeasonListItem({ s }) {
    const isSelected = s.id === selectedSeasonId;
    return (
      <li>
        <div className={`season-item ${isSelected ? 'season-item--active' : ''}`}>
          <button className="season-item-body" onClick={() => setSelectedSeasonId(s.id)}>
            <span className="season-item-name">{s.name}</span>
            <span className={`season-status ${s.is_active ? 'season-status--active' : 'season-status--inactive'}`}>
              {s.is_active ? (s.is_closed ? 'Closed' : 'Active') : 'Inactive'}
            </span>
          </button>
          <button
            className="season-edit-btn"
            onClick={() => setEditSeason(s)}
            title="Edit season"
          >
            <PencilIcon />
          </button>
        </div>
      </li>
    );
  }

  return (
    <div className="teams-layout">
      {/* Season Sidebar */}
      <aside className="season-sidebar">
        <div className="sidebar-header">
          <p className="sidebar-heading">Seasons</p>
          <button className="sidebar-new-btn" onClick={() => setShowCreateSeason(true)}>
            + New
          </button>
        </div>
        {loadingSeasons ? (
          <p className="loading-text">Loading…</p>
        ) : seasons.length === 0 ? (
          <p className="sidebar-empty">No seasons yet.</p>
        ) : (
          <ul className="season-list">
            {activeSeasons.map((s) => (
              <SeasonListItem key={s.id} s={s} />
            ))}
            {activeSeasons.length > 0 && inactiveSeasons.length > 0 && (
              <li className="season-separator" aria-hidden="true" />
            )}
            {inactiveSeasons.map((s) => (
              <SeasonListItem key={s.id} s={s} />
            ))}
          </ul>
        )}
      </aside>

      {/* Main Content */}
      <main className="teams-main">
        <div className="page-header">
          <div>
            <h1 className="page-title">
              {selectedSeason ? selectedSeason.name : 'Team Management'}
            </h1>
            {selectedSeason && (
              <p className="page-subtitle">
                {teamsForSeason.length} team{teamsForSeason.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>
          {selectedSeasonId && (
            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
              + Create Team
            </button>
          )}
        </div>

        {error && <p className="page-error">{error}</p>}

        {!selectedSeasonId ? (
          <p className="empty-text">Select a season to view its teams.</p>
        ) : loadingTeams ? (
          <p className="loading-text">Loading teams…</p>
        ) : teamsForSeason.length === 0 ? (
          <p className="empty-text">No teams for this season yet. Create one above.</p>
        ) : (
          <div className="teams-grid">
            {teamsForSeason.map((team) => (
              <TeamCard
                key={team.id}
                team={team}
                availableTimeslots={availableTimeslots}
                onManage={setManagingTeam}
              />
            ))}
          </div>
        )}
      </main>

      {/* Dialogs */}
      {showCreate && (
        <CreateTeamDialog
          seasons={seasons}
          preselectedSeasonId={selectedSeasonId}
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}

      {managingTeam && (
        <TeamManagementDialog
          team={managingTeam}
          allUsers={allUsers}
          onClose={() => setManagingTeam(null)}
          onUpdated={handleUpdated}
        />
      )}

      {showCreateSeason && (
        <SeasonDialog
          season={null}
          onClose={() => setShowCreateSeason(false)}
          onSaved={handleSeasonSaved}
        />
      )}

      {editSeason && (
        <SeasonDialog
          season={editSeason}
          onClose={() => setEditSeason(null)}
          onSaved={handleSeasonSaved}
        />
      )}
    </div>
  );
}
