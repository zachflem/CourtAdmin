import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './VenuesPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const ACCESS_TYPES = ['key', 'card', 'code', 'other'];

function fullName(u) {
  return [u.first_name, u.last_name].filter(Boolean).join(' ') || u.email;
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'pm' : 'am';
  const h12 = hour % 12 || 12;
  return `${h12}:${m}${ampm}`;
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

// ─── Create Venue Dialog ─────────────────────────────────────────────────────

function CreateVenueDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    address: '',
    contact_name: '',
    contact_phone: '',
    contact_email: '',
    access_instructions: '',
    cost_per_hour: '',
    notes: '',
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
      const venue = await apiFetch('/api/venues', {
        method: 'POST',
        body: JSON.stringify({
          ...form,
          cost_per_hour: form.cost_per_hour ? parseFloat(form.cost_per_hour) : null,
        }),
      });
      onCreated(venue);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Add Venue</h2>
        <form onSubmit={handleSubmit} className="dialog-form">
          <label className="field-label">
            Venue Name *
            <input
              className="field-input"
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              autoFocus
              placeholder="e.g. Crescent Reserve"
            />
          </label>
          <label className="field-label">
            Address
            <input
              className="field-input"
              type="text"
              value={form.address}
              onChange={(e) => set('address', e.target.value)}
              placeholder="123 Main St, Suburb"
            />
          </label>
          <div className="field-row">
            <label className="field-label">
              Contact Name
              <input
                className="field-input"
                type="text"
                value={form.contact_name}
                onChange={(e) => set('contact_name', e.target.value)}
              />
            </label>
            <label className="field-label">
              Contact Phone
              <input
                className="field-input"
                type="tel"
                value={form.contact_phone}
                onChange={(e) => set('contact_phone', e.target.value)}
              />
            </label>
          </div>
          <label className="field-label">
            Contact Email
            <input
              className="field-input"
              type="email"
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
            />
          </label>
          <label className="field-label">
            Cost per Hour ($)
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={form.cost_per_hour}
              onChange={(e) => set('cost_per_hour', e.target.value)}
              placeholder="0.00"
            />
          </label>
          {error && <p className="dialog-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Create Venue'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Manage Venue Dialog ─────────────────────────────────────────────────────

function ManageVenueDialog({ venueId, canEdit, onClose, onUpdated, onDeleted }) {
  const [venue, setVenue] = useState(null);
  const [allUsers, setAllUsers] = useState([]);
  const [allTeams, setAllTeams] = useState([]);
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadVenue = useCallback(async () => {
    try {
      const v = await apiFetch(`/api/venues/${venueId}`);
      setVenue(v);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [venueId]);

  useEffect(() => {
    loadVenue();
    if (canEdit) {
      Promise.all([apiFetch('/api/users'), apiFetch('/api/teams')]).then(([u, t]) => {
        setAllUsers(u);
        setAllTeams(t);
      }).catch(() => {});
    }
  }, [loadVenue, canEdit]);

  if (loading) {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
          <p className="loading-text">Loading…</p>
        </div>
      </div>
    );
  }

  if (!venue) {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
          <p className="dialog-error">{error || 'Venue not found.'}</p>
          <button className="btn btn-ghost btn-sm" onClick={onClose}>Close</button>
        </div>
      </div>
    );
  }

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'timeslots', label: `Timeslots (${venue.timeslots?.length ?? 0})` },
    { key: 'access', label: `Access (${venue.access?.length ?? 0})` },
    { key: 'documents', label: `Documents (${venue.documents?.length ?? 0})` },
    { key: 'teams', label: 'Assigned Teams' },
  ];

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide dialog--tall" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">{venue.name}</h2>
          {canEdit && (
            <DeleteVenueButton
              venueId={venueId}
              onDeleted={() => { onClose(); onDeleted(venueId); }}
            />
          )}
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
          {activeTab === 'details' && (
            <DetailsTab venue={venue} canEdit={canEdit} onUpdated={(v) => { setVenue(v); onUpdated(v); }} />
          )}
          {activeTab === 'timeslots' && (
            <TimeslotsTab
              venue={venue}
              canEdit={canEdit}
              allTeams={allTeams}
              onReload={loadVenue}
            />
          )}
          {activeTab === 'access' && (
            <AccessTab
              venue={venue}
              canEdit={canEdit}
              allUsers={allUsers}
              onReload={loadVenue}
            />
          )}
          {activeTab === 'documents' && (
            <DocumentsTab venue={venue} canEdit={canEdit} onReload={loadVenue} />
          )}
          {activeTab === 'teams' && (
            <AssignedTeamsTab venue={venue} />
          )}
        </div>

        <div className="dialog-close-row">
          <button className="btn btn-ghost" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}

function DeleteVenueButton({ venueId, onDeleted }) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/venues/${venueId}`, { method: 'DELETE' });
      onDeleted();
    } catch {
      setDeleting(false);
      setConfirming(false);
    }
  }

  if (confirming) {
    return (
      <div className="delete-confirm">
        <span className="delete-confirm-text">Delete this venue?</span>
        <button className="btn btn-danger btn-sm" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Deleting…' : 'Yes, Delete'}
        </button>
        <button className="btn btn-ghost btn-sm" onClick={() => setConfirming(false)}>Cancel</button>
      </div>
    );
  }

  return (
    <button className="btn btn-ghost btn-sm btn-danger" onClick={() => setConfirming(true)}>
      Delete Venue
    </button>
  );
}

// ─── Details Tab ─────────────────────────────────────────────────────────────

function DetailsTab({ venue, canEdit, onUpdated }) {
  const [form, setForm] = useState({
    name: venue.name ?? '',
    address: venue.address ?? '',
    contact_name: venue.contact_name ?? '',
    contact_phone: venue.contact_phone ?? '',
    contact_email: venue.contact_email ?? '',
    access_instructions: venue.access_instructions ?? '',
    cost_per_hour: venue.cost_per_hour != null ? String(venue.cost_per_hour) : '',
    notes: venue.notes ?? '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSaved(false);
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/venues/${venue.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          ...form,
          cost_per_hour: form.cost_per_hour ? parseFloat(form.cost_per_hour) : null,
        }),
      });
      onUpdated(updated);
      setSaved(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!canEdit) {
    return (
      <div className="detail-readonly">
        <DetailRow label="Address" value={venue.address} />
        <DetailRow label="Contact" value={[venue.contact_name, venue.contact_phone, venue.contact_email].filter(Boolean).join(' · ')} />
        <DetailRow label="Cost/Hour" value={venue.cost_per_hour != null ? `$${venue.cost_per_hour}/hr` : null} />
        <DetailRow label="Access Instructions" value={venue.access_instructions} pre />
        <DetailRow label="Notes" value={venue.notes} pre />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="dialog-form">
      <label className="field-label">
        Venue Name *
        <input className="field-input" type="text" value={form.name} onChange={(e) => set('name', e.target.value)} required />
      </label>
      <label className="field-label">
        Address
        <input className="field-input" type="text" value={form.address} onChange={(e) => set('address', e.target.value)} placeholder="123 Main St, Suburb" />
      </label>
      <div className="field-row">
        <label className="field-label">
          Contact Name
          <input className="field-input" type="text" value={form.contact_name} onChange={(e) => set('contact_name', e.target.value)} />
        </label>
        <label className="field-label">
          Contact Phone
          <input className="field-input" type="tel" value={form.contact_phone} onChange={(e) => set('contact_phone', e.target.value)} />
        </label>
      </div>
      <label className="field-label">
        Contact Email
        <input className="field-input" type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} />
      </label>
      <label className="field-label">
        Access Instructions
        <textarea className="field-input field-textarea" value={form.access_instructions} onChange={(e) => set('access_instructions', e.target.value)} rows={3} placeholder="Door code, key location, gate PIN…" />
      </label>
      <label className="field-label">
        Cost per Hour ($)
        <input className="field-input" type="number" min="0" step="0.01" value={form.cost_per_hour} onChange={(e) => set('cost_per_hour', e.target.value)} placeholder="0.00" />
      </label>
      <label className="field-label">
        Notes
        <textarea className="field-input field-textarea" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
      </label>
      {error && <p className="dialog-error">{error}</p>}
      <div className="dialog-actions">
        {saved && <span className="save-confirm">Saved</span>}
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </form>
  );
}

function DetailRow({ label, value, pre }) {
  if (!value) return null;
  return (
    <div className="detail-row">
      <span className="detail-label">{label}</span>
      {pre ? <pre className="detail-value detail-value--pre">{value}</pre> : <span className="detail-value">{value}</span>}
    </div>
  );
}

// ─── Timeslots Tab ───────────────────────────────────────────────────────────

function TimeslotsTab({ venue, canEdit, allTeams, onReload }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newSlot, setNewSlot] = useState({ day_of_week: 'Monday', start_time: '18:00', end_time: '19:30' });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  async function handleAddSlot(e) {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    try {
      await apiFetch(`/api/venues/${venue.id}/timeslots`, {
        method: 'POST',
        body: JSON.stringify(newSlot),
      });
      setShowAdd(false);
      setNewSlot({ day_of_week: 'Monday', start_time: '18:00', end_time: '19:30' });
      onReload();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRemoveSlot(slotId) {
    try {
      await apiFetch(`/api/venues/${venue.id}/timeslots/${slotId}`, { method: 'DELETE' });
      onReload();
    } catch { /* ignore */ }
  }

  return (
    <div className="tab-section">
      {venue.timeslots?.length === 0 && (
        <p className="empty-text">No timeslots yet.</p>
      )}
      {venue.timeslots?.map((slot) => (
        <TimeslotRow
          key={slot.id}
          slot={slot}
          canEdit={canEdit}
          allTeams={allTeams}
          onRemove={() => handleRemoveSlot(slot.id)}
          onReload={onReload}
        />
      ))}

      {canEdit && (
        showAdd ? (
          <form onSubmit={handleAddSlot} className="add-slot-form">
            <div className="field-row">
              <label className="field-label">
                Day
                <select
                  className="field-input"
                  value={newSlot.day_of_week}
                  onChange={(e) => setNewSlot((s) => ({ ...s, day_of_week: e.target.value }))}
                >
                  {DAYS.map((d) => <option key={d}>{d}</option>)}
                </select>
              </label>
              <label className="field-label">
                Start
                <input className="field-input" type="time" value={newSlot.start_time}
                  onChange={(e) => setNewSlot((s) => ({ ...s, start_time: e.target.value }))} required />
              </label>
              <label className="field-label">
                End
                <input className="field-input" type="time" value={newSlot.end_time}
                  onChange={(e) => setNewSlot((s) => ({ ...s, end_time: e.target.value }))} required />
              </label>
            </div>
            {addError && <p className="dialog-error">{addError}</p>}
            <div className="add-form-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={adding}>
                {adding ? 'Adding…' : 'Add'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}>
            + Add Timeslot
          </button>
        )
      )}
    </div>
  );
}

function TimeslotRow({ slot, canEdit, allTeams, onRemove, onReload }) {
  const [showAssign, setShowAssign] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState('');
  const [assigning, setAssigning] = useState(false);

  const assignedTeamIds = new Set((slot.assigned_teams ?? []).map((t) => t.team_id));

  async function handleAssign(e) {
    e.preventDefault();
    if (!selectedTeamId) return;
    setAssigning(true);
    try {
      await apiFetch(`/api/teams/${selectedTeamId}`, {
        method: 'PUT',
        body: JSON.stringify({ add_timeslots: [slot.id] }),
      });
      setShowAssign(false);
      setSelectedTeamId('');
      onReload();
    } catch { /* ignore */ } finally {
      setAssigning(false);
    }
  }

  async function handleUnassign(teamId) {
    try {
      await apiFetch(`/api/teams/${teamId}`, {
        method: 'PUT',
        body: JSON.stringify({ remove_timeslots: [slot.id] }),
      });
      onReload();
    } catch { /* ignore */ }
  }

  const unassignedTeams = allTeams.filter((t) => !assignedTeamIds.has(t.id));

  return (
    <div className="timeslot-row">
      <div className="timeslot-info">
        <span className="timeslot-day">{slot.day_of_week}</span>
        <span className="timeslot-time">{formatTime(slot.start_time)} – {formatTime(slot.end_time)}</span>
      </div>
      <div className="timeslot-teams">
        {(slot.assigned_teams ?? []).map((t) => (
          <span key={t.team_id} className="team-tag">
            {t.team_name}
            {canEdit && (
              <button className="team-tag-remove" onClick={() => handleUnassign(t.team_id)} title="Unassign">×</button>
            )}
          </span>
        ))}
        {canEdit && !showAssign && unassignedTeams.length > 0 && (
          <button className="btn btn-ghost btn-xs" onClick={() => setShowAssign(true)}>+ Assign Team</button>
        )}
        {canEdit && showAssign && (
          <form onSubmit={handleAssign} className="assign-inline">
            <select
              className="field-input field-input--sm"
              value={selectedTeamId}
              onChange={(e) => setSelectedTeamId(e.target.value)}
              autoFocus
            >
              <option value="">Pick a team…</option>
              {unassignedTeams.map((t) => (
                <option key={t.id} value={t.id}>{t.name} ({t.age_group})</option>
              ))}
            </select>
            <button type="submit" className="btn btn-primary btn-xs" disabled={!selectedTeamId || assigning}>
              {assigning ? '…' : 'Assign'}
            </button>
            <button type="button" className="btn btn-ghost btn-xs" onClick={() => setShowAssign(false)}>×</button>
          </form>
        )}
      </div>
      {canEdit && (
        <button className="btn btn-ghost btn-xs btn-danger" onClick={onRemove}>Remove</button>
      )}
    </div>
  );
}

// ─── Access Tab ───────────────────────────────────────────────────────────────

function AccessTab({ venue, canEdit, allUsers, onReload }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newAccess, setNewAccess] = useState({ user_id: '', access_type: 'key', notes: '' });
  const [addError, setAddError] = useState('');
  const [adding, setAdding] = useState(false);

  const existingUserIds = new Set((venue.access ?? []).map((a) => a.user_id));
  const availableUsers = allUsers.filter((u) => !existingUserIds.has(u.id));

  async function handleAdd(e) {
    e.preventDefault();
    setAddError('');
    setAdding(true);
    try {
      await apiFetch(`/api/venues/${venue.id}/access`, {
        method: 'POST',
        body: JSON.stringify(newAccess),
      });
      setShowAdd(false);
      setNewAccess({ user_id: '', access_type: 'key', notes: '' });
      onReload();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAdding(false);
    }
  }

  async function handleRevoke(userId) {
    try {
      await apiFetch(`/api/venues/${venue.id}/access/${userId}`, { method: 'DELETE' });
      onReload();
    } catch { /* ignore */ }
  }

  return (
    <div className="tab-section">
      {venue.access?.length === 0 && (
        <p className="empty-text">No access holders recorded.</p>
      )}
      {venue.access?.map((a) => (
        <div key={a.user_id} className="member-row">
          <div className="member-info">
            <span className="member-name">{fullName(a)}</span>
            <span className="member-email">{a.email}</span>
          </div>
          <span className={`access-badge access-badge--${a.access_type}`}>{a.access_type}</span>
          {a.notes && <span className="access-notes">{a.notes}</span>}
          {canEdit && (
            <button className="btn btn-ghost btn-xs btn-danger" onClick={() => handleRevoke(a.user_id)}>
              Revoke
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        showAdd ? (
          <form onSubmit={handleAdd} className="add-slot-form">
            <label className="field-label">
              User
              <select
                className="field-input"
                value={newAccess.user_id}
                onChange={(e) => setNewAccess((s) => ({ ...s, user_id: e.target.value }))}
                required
              >
                <option value="">Select a user…</option>
                {availableUsers.map((u) => (
                  <option key={u.id} value={u.id}>{fullName(u)} ({u.email})</option>
                ))}
              </select>
            </label>
            <div className="field-row">
              <label className="field-label">
                Access Type
                <select
                  className="field-input"
                  value={newAccess.access_type}
                  onChange={(e) => setNewAccess((s) => ({ ...s, access_type: e.target.value }))}
                >
                  {ACCESS_TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
              </label>
              <label className="field-label">
                Notes
                <input
                  className="field-input"
                  type="text"
                  value={newAccess.notes}
                  onChange={(e) => setNewAccess((s) => ({ ...s, notes: e.target.value }))}
                  placeholder="Optional note"
                />
              </label>
            </div>
            {addError && <p className="dialog-error">{addError}</p>}
            <div className="add-form-actions">
              <button type="submit" className="btn btn-primary btn-sm" disabled={adding || !newAccess.user_id}>
                {adding ? 'Adding…' : 'Grant Access'}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowAdd(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button className="btn btn-ghost btn-sm" onClick={() => setShowAdd(true)}>
            + Add Access Holder
          </button>
        )
      )}
    </div>
  );
}

// ─── Documents Tab ───────────────────────────────────────────────────────────

function DocumentsTab({ venue, canEdit, onReload }) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError('');
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    formData.append('document_name', file.name);
    try {
      const res = await fetch(`${API_BASE}/api/venues/${venue.id}/documents`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      onReload();
    } catch (err) {
      setUploadError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete(docId) {
    try {
      await apiFetch(`/api/venues/${venue.id}/documents/${docId}`, { method: 'DELETE' });
      onReload();
    } catch { /* ignore */ }
  }

  return (
    <div className="tab-section">
      {venue.documents?.length === 0 && (
        <p className="empty-text">No documents uploaded.</p>
      )}
      {venue.documents?.map((doc) => (
        <div key={doc.id} className="doc-row">
          <a href={doc.document_url} target="_blank" rel="noreferrer" className="doc-link">
            {doc.document_name}
          </a>
          {canEdit && (
            <button className="btn btn-ghost btn-xs btn-danger" onClick={() => handleDelete(doc.id)}>
              Delete
            </button>
          )}
        </div>
      ))}

      {canEdit && (
        <div className="upload-row">
          <label className="btn btn-ghost btn-sm upload-label">
            {uploading ? 'Uploading…' : '+ Upload Document'}
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.gif,.webp"
              style={{ display: 'none' }}
              onChange={handleUpload}
              disabled={uploading}
            />
          </label>
          {uploadError && <span className="dialog-error">{uploadError}</span>}
        </div>
      )}
    </div>
  );
}

// ─── Assigned Teams Tab ───────────────────────────────────────────────────────

function AssignedTeamsTab({ venue }) {
  const allAssigned = (venue.timeslots ?? []).flatMap((slot) =>
    (slot.assigned_teams ?? []).map((t) => ({ ...t, day_of_week: slot.day_of_week, start_time: slot.start_time, end_time: slot.end_time }))
  );

  if (allAssigned.length === 0) {
    return <p className="empty-text">No teams assigned to this venue yet.</p>;
  }

  const byTeam = new Map();
  for (const row of allAssigned) {
    if (!byTeam.has(row.team_id)) byTeam.set(row.team_id, { name: row.team_name, age_group: row.age_group, season_name: row.season_name, slots: [] });
    byTeam.get(row.team_id).slots.push({ day: row.day_of_week, start: row.start_time, end: row.end_time });
  }

  return (
    <div className="tab-section">
      {[...byTeam.values()].map((team, i) => (
        <div key={i} className="assigned-team-row">
          <div className="assigned-team-info">
            <span className="team-name-text">{team.name}</span>
            {team.age_group && <span className="team-age-badge">{team.age_group}</span>}
            {team.season_name && <span className="season-badge">{team.season_name}</span>}
          </div>
          <div className="assigned-team-slots">
            {team.slots.map((s, j) => (
              <span key={j} className="timeslot-chip">
                {s.day} {formatTime(s.start)}–{formatTime(s.end)}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Venue Card ───────────────────────────────────────────────────────────────

function VenueCard({ venue, canEdit, onManage }) {
  return (
    <div className="venue-card">
      <div className="venue-card-header">
        <h3 className="venue-name">{venue.name}</h3>
        {venue.cost_per_hour != null && (
          <span className="cost-badge">${venue.cost_per_hour}/hr</span>
        )}
      </div>
      {venue.address && <p className="venue-address">{venue.address}</p>}
      <div className="venue-stats">
        <span>{venue.timeslot_count} timeslot{venue.timeslot_count !== 1 ? 's' : ''}</span>
        <span>{venue.team_count} team{venue.team_count !== 1 ? 's' : ''}</span>
        {venue.access_count > 0 && <span>{venue.access_count} keyholder{venue.access_count !== 1 ? 's' : ''}</span>}
      </div>
      {venue.timeslots?.length > 0 && (
        <div className="venue-timeslot-list">
          {venue.timeslots.map((s) => {
            const teams = s.assigned_teams ?? [];
            if (teams.length === 0) {
              return (
                <span key={s.id} className="timeslot-chip timeslot-chip--unassigned">
                  {s.day_of_week} {formatTime(s.start_time)}–{formatTime(s.end_time)}
                </span>
              );
            }
            return teams.map((t) => (
              <span key={`${s.id}-${t.team_id}`} className="timeslot-chip timeslot-chip--assigned">
                {s.day_of_week} {formatTime(s.start_time)}–{formatTime(s.end_time)} · {t.team_name}
              </span>
            ));
          })}
        </div>
      )}
      <div className="venue-card-actions">
        <button className="btn btn-ghost btn-sm" onClick={() => onManage(venue.id)}>
          {canEdit ? 'Manage' : 'View'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function VenuesPage() {
  const { user } = useAuth();
  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const canEdit = roles.includes('admin') || roles.includes('committee');

  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [managingVenueId, setManagingVenueId] = useState(null);

  const loadVenues = useCallback(() => {
    setLoading(true);
    apiFetch('/api/venues')
      .then(setVenues)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadVenues(); }, [loadVenues]);

  function handleCreated(venue) {
    setShowCreate(false);
    setVenues((prev) => [...prev, { ...venue, timeslot_count: 0, team_count: 0, access_count: 0, timeslots: [] }]);
  }

  function handleUpdated(updated) {
    setVenues((prev) => prev.map((v) => (v.id === updated.id ? { ...v, ...updated } : v)));
  }

  function handleDeleted(venueId) {
    setVenues((prev) => prev.filter((v) => v.id !== venueId));
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Venues</h1>
          <p className="page-subtitle">{venues.length} venue{venues.length !== 1 ? 's' : ''}</p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Add Venue
          </button>
        )}
      </div>

      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="loading-text">Loading venues…</p>
      ) : venues.length === 0 ? (
        <p className="empty-text">
          {canEdit ? 'No venues yet. Add one above.' : 'No venues have been added yet.'}
        </p>
      ) : (
        <div className="venues-grid">
          {venues.map((venue) => (
            <VenueCard
              key={venue.id}
              venue={venue}
              canEdit={canEdit}
              onManage={setManagingVenueId}
            />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateVenueDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {managingVenueId && (
        <ManageVenueDialog
          venueId={managingVenueId}
          canEdit={canEdit}
          onClose={() => { setManagingVenueId(null); loadVenues(); }}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
