import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './TeamsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';


// ─── Helpers ────────────────────────────────────────────────────────────────

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

// ─── Create Team Dialog ──────────────────────────────────────────────────────

function CreateTeamDialog({ seasons, preselectedSeasonId, onClose, onCreated }) {
  const { settings: clubSettings } = useClub();
  const ageGroups = clubSettings.age_groups || [];
  const divisions = clubSettings.divisions || [];
  const [form, setForm] = useState({
    name: '',
    season_id: preselectedSeasonId || (seasons[0]?.id ?? ''),
    age_group: ageGroups[0] ?? '',
    division: divisions[0] ?? '',
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

// ─── Member Tab ──────────────────────────────────────────────────────────────

function MemberTab({ members, allUsers, onAdd, onRemove, removing }) {
  const [search, setSearch] = useState('');
  const [adding, setAdding] = useState(null); // userId being added

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

// ─── Team Management Dialog ──────────────────────────────────────────────────

function TeamManagementDialog({ team: initialTeam, allUsers, onClose, onUpdated }) {
  const { settings: clubSettings } = useClub();
  const ageGroups = clubSettings.age_groups || [];
  const divisions = clubSettings.divisions || [];
  const [team, setTeam] = useState(initialTeam);
  const [activeTab, setActiveTab] = useState('players');
  const [editName, setEditName] = useState(initialTeam.name);
  const [editAgeGroup, setEditAgeGroup] = useState(initialTeam.age_group);
  const [editDivision, setEditDivision] = useState(initialTeam.division ?? divisions[0] ?? '');
  const [savingMeta, setSavingMeta] = useState(false);
  const [metaError, setMetaError] = useState('');
  const [removing, setRemoving] = useState(null);

  // Fetch full team (with member arrays) on open
  useEffect(() => {
    apiFetch(`/api/teams/${initialTeam.id}`)
      .then(setTeam)
      .catch(() => {});
  }, [initialTeam.id]);

  async function saveMeta() {
    if (editName === team.name && editAgeGroup === team.age_group && editDivision === (team.division ?? divisions[0] ?? '')) return;
    setMetaError('');
    setSavingMeta(true);
    try {
      const updated = await apiFetch(`/api/teams/${team.id}`, {
        method: 'PUT',
        body: JSON.stringify({ name: editName, age_group: editAgeGroup, division: editDivision }),
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
    // Re-fetch full member lists
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

function TeamCard({ team, onManage }) {
  return (
    <div className="team-card">
      <div className="team-card-header">
        <span className="team-age-badge">{team.age_group}</span>
        {team.division && <span className="team-division-badge">{team.division}</span>}
        <h3 className="team-name">{team.name}</h3>
      </div>
      <div className="team-counts">
        <span>Players: <strong>{team.player_count}</strong></span>
        <span>Coaches: <strong>{team.coach_count}</strong></span>
        <span>Managers: <strong>{team.manager_count}</strong></span>
      </div>
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
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(false);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [managingTeam, setManagingTeam] = useState(null);

  // Load seasons + users once
  useEffect(() => {
    Promise.all([
      apiFetch('/api/seasons'),
      apiFetch('/api/users'),
    ])
      .then(([s, u]) => {
        setSeasons(s);
        setAllUsers(u);
        if (s.length > 0) setSelectedSeasonId(s[0].id);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingSeasons(false));
  }, []);

  // Load teams for selected season
  const fetchTeams = useCallback(
    (seasonId) => {
      if (!seasonId) return;
      setLoadingTeams(true);
      apiFetch(`/api/teams?season_id=${seasonId}`)
        .then(setTeams)
        .catch((err) => setError(err.message))
        .finally(() => setLoadingTeams(false));
    },
    []
  );

  useEffect(() => {
    if (selectedSeasonId) fetchTeams(selectedSeasonId);
  }, [selectedSeasonId, fetchTeams]);

  function handleCreated(team) {
    setShowCreate(false);
    if (team.season_id === selectedSeasonId) {
      setTeams((prev) => [...prev, team]);
    } else {
      // Switch to the season the team was created in
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

  return (
    <div className="teams-layout">
      {/* Season Sidebar */}
      <aside className="season-sidebar">
        <p className="sidebar-heading">Seasons</p>
        {loadingSeasons ? (
          <p className="loading-text">Loading…</p>
        ) : seasons.length === 0 ? (
          <p className="sidebar-empty">No seasons yet.</p>
        ) : (
          <ul className="season-list">
            {seasons.map((s) => (
              <li key={s.id}>
                <button
                  className={`season-item ${s.id === selectedSeasonId ? 'season-item--active' : ''}`}
                  onClick={() => setSelectedSeasonId(s.id)}
                >
                  <span className="season-item-name">{s.name}</span>
                  {s.is_active ? (
                    <span className="season-status season-status--active">Active</span>
                  ) : (
                    <span className="season-status season-status--inactive">Inactive</span>
                  )}
                </button>
              </li>
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
    </div>
  );
}
