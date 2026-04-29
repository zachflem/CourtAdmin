import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './EmailPage.css';

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

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-AU', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function parseRoles(s) {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

// ─── Template Dialog ──────────────────────────────────────────────────────────

function TemplateDialog({ template, onClose, onSaved }) {
  const [form, setForm] = useState({
    name:    template?.name    || '',
    subject: template?.subject || '',
    content: template?.content || '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const url    = template ? `/api/email-templates/${template.id}` : '/api/email-templates';
      const method = template ? 'PUT' : 'POST';
      const saved  = await apiFetch(url, { method, body: JSON.stringify(form) });
      onSaved(saved);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">{template ? 'Edit Template' : 'New Template'}</h2>
        <form onSubmit={handleSubmit}>
          <label className="field-label">
            Template name
            <input
              className="field-input"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
            />
          </label>
          <label className="field-label" style={{ marginTop: '1rem' }}>
            Subject
            <input
              className="field-input"
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
              required
            />
          </label>
          <label className="field-label" style={{ marginTop: '1rem' }}>
            Content (HTML)
            <textarea
              className="field-input field-textarea"
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              rows={10}
              required
            />
          </label>
          {error && <p className="dialog-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : template ? 'Save Changes' : 'Create Template'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Campaign Composer Dialog ─────────────────────────────────────────────────

function CampaignComposerDialog({ templates, users, teams, onClose, onSent }) {
  const { settings: clubSettings } = useClub();
  const ageGroupOptions = clubSettings.age_groups || [];
  const [form, setForm] = useState({
    name:        '',
    subject:     '',
    content:     '',
    template_id: '',
  });
  const [recipientRoles,      setRecipientRoles]      = useState([]);
  const [recipientAgeGroups,  setRecipientAgeGroups]  = useState([]);
  const [recipientTeamIds,    setRecipientTeamIds]    = useState([]);
  const [recipientUserIds,    setRecipientUserIds]    = useState([]);
  const [userSearch,          setUserSearch]          = useState('');
  const [sending,             setSending]             = useState(false);
  const [error,               setError]               = useState('');
  const [confirming,          setConfirming]          = useState(false);

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handleTemplateSelect(templateId) {
    set('template_id', templateId);
    if (templateId) {
      const tmpl = templates.find((t) => t.id === templateId);
      if (tmpl) {
        set('subject', tmpl.subject);
        set('content', tmpl.content);
      }
    }
  }

  function toggleRole(role) {
    setRecipientRoles((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  function toggleAgeGroup(ag) {
    setRecipientAgeGroups((prev) =>
      prev.includes(ag) ? prev.filter((a) => a !== ag) : [...prev, ag]
    );
  }

  function toggleTeam(teamId) {
    setRecipientTeamIds((prev) =>
      prev.includes(teamId) ? prev.filter((id) => id !== teamId) : [...prev, teamId]
    );
  }

  function addUser(user) {
    if (!recipientUserIds.includes(user.id)) {
      setRecipientUserIds((prev) => [...prev, user.id]);
    }
    setUserSearch('');
  }

  function removeUser(userId) {
    setRecipientUserIds((prev) => prev.filter((id) => id !== userId));
  }

  // Estimate deduplicated count from the loaded user list (roles + age groups + individuals).
  // Team membership isn't in the user list, so selected teams are shown separately.
  const byRoleIds = new Set(
    users
      .filter((u) => {
        const ur = parseRoles(u.roles);
        return recipientRoles.some((r) => ur.includes(r));
      })
      .map((u) => u.id)
  );
  const byAgeGroupIds = new Set(
    recipientAgeGroups.length > 0
      ? users.filter((u) => recipientAgeGroups.includes(u.age_group)).map((u) => u.id)
      : []
  );
  const allRecipientIds = new Set([...byRoleIds, ...byAgeGroupIds, ...recipientUserIds]);
  const recipientCount  = allRecipientIds.size;

  const filteredUsers = userSearch.length >= 2
    ? users
        .filter((u) => {
          const name  = `${u.first_name || ''} ${u.last_name || ''}`.toLowerCase();
          const email = (u.email || '').toLowerCase();
          const q     = userSearch.toLowerCase();
          return name.includes(q) || email.includes(q);
        })
        .filter((u) => !recipientUserIds.includes(u.id))
        .slice(0, 8)
    : [];

  const selectedIndividuals = users.filter((u) => recipientUserIds.includes(u.id));

  async function handleSend() {
    setSending(true);
    setError('');
    try {
      const campaign = await apiFetch('/api/email-campaigns', {
        method: 'POST',
        body: JSON.stringify({
          name:                   form.name,
          subject:                form.subject,
          content:                form.content,
          template_id:            form.template_id || null,
          recipient_roles:        recipientRoles,
          recipient_age_groups:   recipientAgeGroups,
          recipient_team_ids:     recipientTeamIds,
          recipient_user_ids:     recipientUserIds,
        }),
      });
      onSent(campaign);
    } catch (err) {
      setError(err.message);
      setSending(false);
      setConfirming(false);
    }
  }

  function handleReview(e) {
    e.preventDefault();
    if (recipientCount === 0 && recipientTeamIds.length === 0) {
      setError('Select at least one recipient role, age group, team, or user.');
      return;
    }
    setError('');
    setConfirming(true);
  }

  return (
    <div className="dialog-backdrop" onClick={!sending ? onClose : undefined}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">New Campaign</h2>

        {!confirming ? (
          <form onSubmit={handleReview}>
            <label className="field-label">
              Campaign name
              <input
                className="field-input"
                value={form.name}
                onChange={(e) => set('name', e.target.value)}
                required
              />
            </label>

            <label className="field-label" style={{ marginTop: '1rem' }}>
              Template (optional — pre-fills subject & content)
              <select
                className="field-input"
                value={form.template_id}
                onChange={(e) => handleTemplateSelect(e.target.value)}
              >
                <option value="">— None —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </label>

            <label className="field-label" style={{ marginTop: '1rem' }}>
              Subject
              <input
                className="field-input"
                value={form.subject}
                onChange={(e) => set('subject', e.target.value)}
                required
              />
            </label>

            <label className="field-label" style={{ marginTop: '1rem' }}>
              Content (HTML)
              <textarea
                className="field-input field-textarea"
                value={form.content}
                onChange={(e) => set('content', e.target.value)}
                rows={8}
                required
              />
            </label>

            <div className="field-label" style={{ marginTop: '1rem' }}>
              Recipients by role
              <div className="role-toggles">
                {ALL_ROLES.map((role) => (
                  <button
                    key={role}
                    type="button"
                    className={`role-toggle${recipientRoles.includes(role) ? ' role-toggle--active' : ''}`}
                    onClick={() => toggleRole(role)}
                  >
                    {role}
                  </button>
                ))}
              </div>
            </div>

            <div className="field-label" style={{ marginTop: '1rem' }}>
              Recipients by age group
              <div className="role-toggles">
                {ageGroupOptions.map((ag) => (
                  <button
                    key={ag}
                    type="button"
                    className={`role-toggle${recipientAgeGroups.includes(ag) ? ' role-toggle--active' : ''}`}
                    onClick={() => toggleAgeGroup(ag)}
                  >
                    {ag}
                  </button>
                ))}
              </div>
            </div>

            {teams.length > 0 && (
              <div className="field-label" style={{ marginTop: '1rem' }}>
                Recipients by team
                <div className="team-checkbox-list">
                  {teams.map((t) => (
                    <label key={t.id} className="team-checkbox-row">
                      <input
                        type="checkbox"
                        checked={recipientTeamIds.includes(t.id)}
                        onChange={() => toggleTeam(t.id)}
                      />
                      <span className="team-checkbox-name">{t.name}</span>
                      <span className="team-checkbox-meta">
                        {t.age_group}{t.division ? ` · ${t.division}` : ''} · {t.season_name}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="field-label" style={{ marginTop: '1rem' }}>
              Individual recipients
              <input
                className="field-input"
                placeholder="Search by name or email…"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                autoComplete="off"
              />
              {filteredUsers.length > 0 && (
                <div className="user-search-results">
                  {filteredUsers.map((u) => (
                    <button
                      key={u.id}
                      type="button"
                      className="user-search-result"
                      onClick={() => addUser(u)}
                    >
                      <span>{`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}</span>
                      <span className="user-search-email">{u.email}</span>
                    </button>
                  ))}
                </div>
              )}
              {selectedIndividuals.length > 0 && (
                <div className="selected-user-tags">
                  {selectedIndividuals.map((u) => (
                    <span key={u.id} className="selected-user-tag">
                      {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                      <button
                        type="button"
                        className="selected-user-remove"
                        onClick={() => removeUser(u.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {(recipientCount > 0 || recipientTeamIds.length > 0) && (
              <p className="recipient-count">
                {recipientCount > 0 && (
                  <>{recipientCount} recipient{recipientCount !== 1 ? 's' : ''} from roles / age groups / individuals</>
                )}
                {recipientCount > 0 && recipientTeamIds.length > 0 && ' + '}
                {recipientTeamIds.length > 0 && (
                  <>{recipientTeamIds.length} team{recipientTeamIds.length !== 1 ? 's' : ''} (members resolved on send)</>
                )}
              </p>
            )}

            {error && <p className="dialog-error" style={{ marginTop: '0.75rem' }}>{error}</p>}

            <div className="dialog-actions">
              <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
              <button type="submit" className="btn btn-primary">Review & Send</button>
            </div>
          </form>
        ) : (
          <div>
            <div className="confirm-box">
              <p className="confirm-message">
                Send <strong>"{form.name}"</strong>?
              </p>
              <p className="confirm-detail">Subject: {form.subject}</p>
              {recipientRoles.length > 0 && (
                <p className="confirm-detail">Roles: {recipientRoles.join(', ')}</p>
              )}
              {recipientAgeGroups.length > 0 && (
                <p className="confirm-detail">Age groups: {recipientAgeGroups.join(', ')}</p>
              )}
              {recipientTeamIds.length > 0 && (
                <p className="confirm-detail">
                  Teams: {recipientTeamIds.length} selected
                </p>
              )}
              {recipientUserIds.length > 0 && (
                <p className="confirm-detail">
                  Individuals: {recipientUserIds.length} selected
                </p>
              )}
            </div>
            {error && <p className="dialog-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
            <div className="dialog-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirming(false)}
                disabled={sending}
              >
                Back
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSend}
                disabled={sending}
              >
                {sending ? 'Sending…' : 'Confirm Send'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Templates Tab ────────────────────────────────────────────────────────────

function TemplatesTab({ templates, onRefresh }) {
  const [editing,  setEditing]  = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState('');

  async function handleDelete(template) {
    setDeleteError('');
    try {
      await apiFetch(`/api/email-templates/${template.id}`, { method: 'DELETE' });
      setDeleting(null);
      onRefresh();
    } catch (err) {
      setDeleteError(err.message);
    }
  }

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <button className="btn btn-primary" onClick={() => setEditing({})}>
          + New Template
        </button>
      </div>

      {deleteError && <p className="page-error">{deleteError}</p>}

      {templates.length === 0 ? (
        <p className="empty-text">No templates yet. Create one to reuse content across campaigns.</p>
      ) : (
        <div className="template-list">
          {templates.map((t) => (
            <div key={t.id} className="template-card">
              <div className="template-card-body">
                <div className="template-name">{t.name}</div>
                <div className="template-subject">{t.subject}</div>
                <div className="template-meta">
                  Created by {t.creator_first_name} {t.creator_last_name} · {formatDate(t.created_at)}
                </div>
              </div>
              <div className="template-card-actions">
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setEditing(t); setDeleteError(''); }}
                >
                  Edit
                </button>
                {deleting?.id === t.id ? (
                  <>
                    <span className="delete-confirm-text">Delete?</span>
                    <button className="btn btn-danger btn-sm" onClick={() => handleDelete(t)}>Yes</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setDeleting(null)}>No</button>
                  </>
                ) : (
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={() => { setDeleting(t); setDeleteError(''); }}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {editing !== null && (
        <TemplateDialog
          template={editing.id ? editing : null}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Campaigns Tab ────────────────────────────────────────────────────────────

const STATUS_COLOR = {
  draft:   '#6b7280',
  sending: '#d97706',
  sent:    '#16a34a',
  failed:  '#dc2626',
};

function CampaignsTab({ campaigns, templates, users, teams, onRefresh }) {
  const [composing, setComposing] = useState(false);

  return (
    <div className="tab-panel">
      <div className="panel-header">
        <button className="btn btn-primary" onClick={() => setComposing(true)}>
          + New Campaign
        </button>
      </div>

      {campaigns.length === 0 ? (
        <p className="empty-text">No campaigns sent yet.</p>
      ) : (
        <div className="table-wrapper">
          <table className="data-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Subject</th>
                <th>Status</th>
                <th>Sent</th>
                <th>Failed</th>
                <th>Sent by</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c) => (
                <tr key={c.id}>
                  <td>{c.name}</td>
                  <td>{c.subject}</td>
                  <td>
                    <span className="campaign-status" style={{ color: STATUS_COLOR[c.status] || '#6b7280' }}>
                      {c.status}
                    </span>
                  </td>
                  <td>{c.sent_count}</td>
                  <td>{c.failed_count > 0 ? <span style={{ color: '#dc2626' }}>{c.failed_count}</span> : '0'}</td>
                  <td>{c.sender_first_name} {c.sender_last_name}</td>
                  <td>{formatDate(c.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {composing && (
        <CampaignComposerDialog
          templates={templates}
          users={users}
          teams={teams}
          onClose={() => setComposing(false)}
          onSent={() => { setComposing(false); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Reply Dialog ─────────────────────────────────────────────────────────────

function ReplyDialog({ enquiry, onClose, onReplied }) {
  const [form, setForm] = useState({
    subject: `Re: ${enquiry.enquiry_type} enquiry from ${enquiry.name}`,
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [error,   setError]   = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      await apiFetch(`/api/contact-messages/${enquiry.id}/reply`, {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onReplied(enquiry.id);
    } catch (err) {
      setError(err.message);
      setSending(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={!sending ? onClose : undefined}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Reply to {enquiry.name}</h2>
        <p className="reply-to-address">To: {enquiry.email}</p>
        <form onSubmit={handleSubmit}>
          <label className="field-label">
            Subject
            <input
              className="field-input"
              value={form.subject}
              onChange={(e) => set('subject', e.target.value)}
              required
            />
          </label>
          <label className="field-label" style={{ marginTop: '1rem' }}>
            Message
            <textarea
              className="field-input field-textarea"
              value={form.message}
              onChange={(e) => set('message', e.target.value)}
              rows={8}
              placeholder="Write your reply…"
              required
              autoFocus
            />
          </label>
          {error && <p className="dialog-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose} disabled={sending}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={sending}>
              {sending ? 'Sending…' : 'Send Reply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Enquiries Tab ────────────────────────────────────────────────────────────

function EnquiriesTab({ enquiries, onMarkRead, onDelete, onReplied }) {
  const [replying, setReplying] = useState(null);

  return (
    <div className="tab-panel">
      {enquiries.length === 0 ? (
        <p className="empty-text">No contact enquiries yet.</p>
      ) : (
        <div className="enquiry-list">
          {enquiries.map((e) => (
            <div key={e.id} className={`enquiry-card${e.is_read ? '' : ' enquiry-card--unread'}`}>
              <div className="enquiry-card-header">
                <div className="enquiry-meta">
                  <span className="enquiry-name">{e.name}</span>
                  <span className="enquiry-email">{e.email}</span>
                  <span className="enquiry-type">{e.enquiry_type}</span>
                  <span className="enquiry-date">{formatDate(e.created_at)}</span>
                  {e.replied_at && (
                    <span className="enquiry-replied">Replied {formatDate(e.replied_at)}</span>
                  )}
                </div>
                <div className="enquiry-actions">
                  <button className="btn btn-primary btn-sm" onClick={() => setReplying(e)}>
                    Reply
                  </button>
                  {!e.is_read && (
                    <button className="btn btn-ghost btn-sm" onClick={() => onMarkRead(e.id)}>
                      Mark read
                    </button>
                  )}
                  <button className="btn btn-danger btn-sm" onClick={() => onDelete(e.id)}>
                    Delete
                  </button>
                </div>
              </div>
              <p className="enquiry-message">{e.message}</p>
            </div>
          ))}
        </div>
      )}

      {replying && (
        <ReplyDialog
          enquiry={replying}
          onClose={() => setReplying(null)}
          onReplied={(id) => { setReplying(null); onReplied(id); }}
        />
      )}
    </div>
  );
}

// ─── MessagesPage ─────────────────────────────────────────────────────────────

export function EmailPage() {
  const { user } = useAuth();
  const roles     = parseRoles(user?.roles);
  const canAccess = roles.includes('admin') || roles.includes('committee');

  const [activeTab, setActiveTab] = useState('enquiries');
  const [campaigns,  setCampaigns]  = useState([]);
  const [templates,  setTemplates]  = useState([]);
  const [users,      setUsers]      = useState([]);
  const [teams,      setTeams]      = useState([]);
  const [enquiries,  setEnquiries]  = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  const fetchData = useCallback(() => {
    setLoading(true);
    setError('');
    Promise.all([
      apiFetch('/api/email-campaigns'),
      apiFetch('/api/email-templates'),
      apiFetch('/api/users'),
      apiFetch('/api/teams'),
      apiFetch('/api/contact-messages'),
    ])
      .then(([campaignsData, templatesData, usersData, teamsData, enquiriesData]) => {
        setCampaigns(campaignsData);
        setTemplates(templatesData);
        setUsers(usersData);
        setTeams(teamsData);
        setEnquiries(enquiriesData);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function handleMarkRead(id) {
    await apiFetch(`/api/contact-messages/${id}/read`, { method: 'PUT' });
    setEnquiries((prev) => prev.map((e) => e.id === id ? { ...e, is_read: 1 } : e));
  }

  async function handleDelete(id) {
    await apiFetch(`/api/contact-messages/${id}`, { method: 'DELETE' });
    setEnquiries((prev) => prev.filter((e) => e.id !== id));
  }

  function handleReplied(id) {
    const now = new Date().toISOString();
    setEnquiries((prev) =>
      prev.map((e) => e.id === id ? { ...e, is_read: 1, replied_at: now } : e)
    );
  }

  if (!canAccess) {
    return (
      <div className="page-container">
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  const unreadCount = enquiries.filter((e) => !e.is_read).length;

  const tabs = [
    { key: 'enquiries', label: `Enquiries${unreadCount > 0 ? ` (${unreadCount} new)` : ` (${enquiries.length})`}` },
    { key: 'campaigns', label: `Campaigns (${campaigns.length})` },
    { key: 'templates', label: `Templates (${templates.length})` },
  ];

  return (
    <div className="email-page">
      <div className="page-header">
        <h1 className="page-title">Messages</h1>
      </div>

      <div className="tab-bar">
        {tabs.map((t) => (
          <button
            key={t.key}
            className={`tab-btn${activeTab === t.key ? ' tab-btn--active' : ''}`}
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
          {activeTab === 'enquiries' && (
            <EnquiriesTab
              enquiries={enquiries}
              onMarkRead={handleMarkRead}
              onDelete={handleDelete}
              onReplied={handleReplied}
            />
          )}
          {activeTab === 'campaigns' && (
            <CampaignsTab
              campaigns={campaigns}
              templates={templates}
              users={users}
              teams={teams}
              onRefresh={fetchData}
            />
          )}
          {activeTab === 'templates' && (
            <TemplatesTab
              templates={templates}
              onRefresh={fetchData}
            />
          )}
        </>
      )}
    </div>
  );
}
