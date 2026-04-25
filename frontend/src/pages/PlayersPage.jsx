import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './PlayersPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

function fullName(eoi) {
  return `${eoi.first_name} ${eoi.last_name}`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

// ─── EOI Card (inbox) ────────────────────────────────────────────────────────

function EOICard({ eoi, onProcess }) {
  return (
    <div className="eoi-card">
      <div className="eoi-card-top">
        <div>
          <p className="eoi-name">{fullName(eoi)}</p>
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
      <td>{fullName(eoi)}</td>
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

function EOIProcessDialog({ eoi, onClose, onDone }) {
  const [ageGroup, setAgeGroup] = useState(null);
  const [ageGroupLoading, setAgeGroupLoading] = useState(true);
  const [availableJerseys, setAvailableJerseys] = useState([]);
  const [availableTeams, setAvailableTeams] = useState([]);
  const [jerseyNumber, setJerseyNumber] = useState('');
  const [selectedTeams, setSelectedTeams] = useState([]);
  const [notes, setNotes] = useState('');
  const [action, setAction] = useState('approve'); // 'approve' | 'reject'
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Load calculated age group
  useEffect(() => {
    apiFetch(`/api/eoi/${eoi.id}/calculated-age-group`)
      .then((data) => {
        setAgeGroup(data.age_group);
        setAgeGroupLoading(false);
      })
      .catch(() => setAgeGroupLoading(false));
  }, [eoi.id]);

  // Load available jersey numbers once age group is known
  useEffect(() => {
    if (!ageGroup) return;
    apiFetch(`/api/players/available-jersey-numbers/${ageGroup}`)
      .then((data) => setAvailableJerseys(data.available))
      .catch(() => {});
  }, [ageGroup]);

  // Load teams for the age group
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

      await apiFetch(`/api/eoi/${eoi.id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
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
        <h2 className="dialog-title">Process Application — {fullName(eoi)}</h2>

        {/* Applicant details */}
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
          {eoi.additional_notes ? (
            <DetailRow label="Notes" value={eoi.additional_notes} />
          ) : null}
        </div>

        {/* Calculated age group */}
        <div className="age-group-row">
          <span className="age-group-label">Calculated Age Group:</span>
          {ageGroupLoading
            ? <span className="age-group-loading">Calculating…</span>
            : <span className="age-group-value">{ageGroup ?? 'Unknown'}</span>
          }
        </div>

        <form onSubmit={handleSubmit} className="process-form">
          {/* Action selector */}
          <div className="action-toggle">
            <button
              type="button"
              className={`action-btn ${action === 'approve' ? 'action-btn--active' : ''}`}
              onClick={() => setAction('approve')}
            >
              Approve
            </button>
            <button
              type="button"
              className={`action-btn action-btn--reject ${action === 'reject' ? 'action-btn--active action-btn--active-reject' : ''}`}
              onClick={() => setAction('reject')}
            >
              Reject
            </button>
          </div>

          {action === 'approve' && (
            <>
              <label className="field-label">
                Jersey Number
                <select
                  className="field-input"
                  value={jerseyNumber}
                  onChange={(e) => setJerseyNumber(e.target.value)}
                  required
                >
                  <option value="">Select jersey number…</option>
                  {availableJerseys.map((n) => (
                    <option key={n} value={n}>#{n}</option>
                  ))}
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
                        <input
                          type="checkbox"
                          checked={selectedTeams.includes(team.id)}
                          onChange={() => toggleTeam(team.id)}
                        />
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
            <textarea
              className="field-input field-textarea"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={action === 'reject' ? 'Reason for rejection…' : 'Internal notes…'}
              rows={3}
            />
          </label>

          {error && <p className="dialog-error">{error}</p>}

          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
              Cancel
            </button>
            <button
              type="submit"
              className={`btn ${action === 'approve' ? 'btn-primary' : 'btn-danger-solid'}`}
              disabled={saving || (action === 'approve' && !jerseyNumber)}
            >
              {saving ? 'Saving…' : action === 'approve' ? 'Approve Player' : 'Reject Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PlayersPage() {
  const { user } = useAuth();
  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const canEdit = roles.includes('admin') || roles.includes('committee');

  const [activeTab, setActiveTab] = useState('inbox');
  const [eois, setEois] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [processingEoi, setProcessingEoi] = useState(null);

  const fetchEois = useCallback(() => {
    setLoading(true);
    apiFetch('/api/eoi')
      .then(setEois)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchEois(); }, [fetchEois]);

  if (!canEdit) {
    return (
      <div className="page-container">
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  const pendingEois = eois.filter((e) => e.status === 'pending');
  const processedEois = eois.filter((e) => e.status !== 'pending');
  const allPlayers = []; // Phase 8 will populate this

  const tabs = [
    { key: 'players', label: `Players (${allPlayers.length})` },
    { key: 'inbox', label: `EOI Inbox (${pendingEois.length})` },
    { key: 'processed', label: `Processed (${processedEois.length})` },
  ];

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

      {/* Players tab — placeholder for Phase 8 */}
      {activeTab === 'players' && (
        <div className="tab-panel">
          <p className="empty-text">Player directory coming in Phase 8.</p>
        </div>
      )}

      {/* EOI Inbox */}
      {activeTab === 'inbox' && (
        <div className="tab-panel">
          {loading ? (
            <p className="loading-text">Loading…</p>
          ) : pendingEois.length === 0 ? (
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

      {/* Processed EOIs */}
      {activeTab === 'processed' && (
        <div className="tab-panel">
          {loading ? (
            <p className="loading-text">Loading…</p>
          ) : processedEois.length === 0 ? (
            <p className="empty-text">No processed applications yet.</p>
          ) : (
            <div className="table-wrapper">
              <table className="processed-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Season</th>
                    <th>Status</th>
                    <th>Processed</th>
                    <th>Processed By</th>
                  </tr>
                </thead>
                <tbody>
                  {processedEois.map((eoi) => (
                    <ProcessedRow key={eoi.id} eoi={eoi} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {processingEoi && (
        <EOIProcessDialog
          eoi={processingEoi}
          onClose={() => setProcessingEoi(null)}
          onDone={() => {
            setProcessingEoi(null);
            fetchEois();
          }}
        />
      )}
    </div>
  );
}
