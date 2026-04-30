import { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import './SponsorsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const TIERS = ['gold', 'silver', 'bronze', 'general'];
const TIER_LABELS = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze', general: 'General' };
const LOGO_SIZES = ['small', 'medium', 'large'];
const LOGO_SIZE_LABELS = { small: 'Small', medium: 'Medium', large: 'Large' };
const LOGO_SIZE_HINTS = {
  small: 'Recommended: 200×80px',
  medium: 'Recommended: 400×160px',
  large: 'Recommended: 800×320px',
};

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

// ─── Tier Badge ──────────────────────────────────────────────────────────────

function TierBadge({ tier }) {
  return <span className={`tier-badge tier-badge--${tier}`}>{TIER_LABELS[tier] ?? tier}</span>;
}

// ─── Logo Upload Slot ────────────────────────────────────────────────────────

function LogoSlot({ sponsorId, size, currentUrl, onUpdated }) {
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_BASE}/api/sponsors/${sponsorId}/logo/${size}`, {
        method: 'POST',
        credentials: 'include',
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Upload failed');
      }
      const { url } = await res.json();
      onUpdated(size, url);
    } catch (err) {
      setError(err.message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  }

  async function handleDelete() {
    setError('');
    setDeleting(true);
    try {
      await apiFetch(`/api/sponsors/${sponsorId}/logo/${size}`, { method: 'DELETE' });
      onUpdated(size, null);
    } catch (err) {
      setError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="logo-slot">
      <div className="logo-slot-header">
        <span className="logo-slot-label">{LOGO_SIZE_LABELS[size]} logo</span>
        <span className="logo-slot-hint">{LOGO_SIZE_HINTS[size]}</span>
      </div>
      {currentUrl ? (
        <div className="logo-slot-preview">
          <img src={currentUrl} alt={`${size} logo`} className="logo-preview-img" />
          <button
            type="button"
            className="btn btn-ghost btn-xs"
            onClick={handleDelete}
            disabled={deleting}
          >
            {deleting ? 'Removing…' : 'Remove'}
          </button>
        </div>
      ) : (
        <label className="logo-upload-label">
          <input
            type="file"
            accept="image/jpeg,image/png,image/gif,image/webp"
            onChange={handleUpload}
            disabled={uploading}
            className="logo-upload-input"
          />
          <span className="btn btn-ghost btn-sm">{uploading ? 'Uploading…' : 'Upload image'}</span>
        </label>
      )}
      {error && <p className="field-error">{error}</p>}
    </div>
  );
}

// ─── Create Sponsor Dialog ───────────────────────────────────────────────────

function CreateSponsorDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '',
    tier: 'general',
    website_url: '',
    contact_name: '',
    contact_email: '',
    contact_phone: '',
    description: '',
    show_on_homepage: false,
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
      const sponsor = await apiFetch('/api/sponsors', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      onCreated(sponsor);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <h2 className="dialog-title">Add Sponsor</h2>
        <form onSubmit={handleSubmit} className="dialog-form">
          <label className="field-label">
            Sponsor Name *
            <input
              className="field-input"
              type="text"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              required
              autoFocus
              placeholder="e.g. Acme Corp"
            />
          </label>

          <label className="field-label">
            Tier *
            <select
              className="field-input"
              value={form.tier}
              onChange={(e) => set('tier', e.target.value)}
            >
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {TIER_LABELS[t]}
                </option>
              ))}
            </select>
          </label>

          <label className="field-label">
            Website URL
            <input
              className="field-input"
              type="url"
              value={form.website_url}
              onChange={(e) => set('website_url', e.target.value)}
              placeholder="https://example.com"
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
            Description
            <textarea
              className="field-input field-textarea"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Brief description of the sponsor…"
            />
          </label>

          <label className="field-checkbox">
            <input
              type="checkbox"
              checked={form.show_on_homepage}
              onChange={(e) => set('show_on_homepage', e.target.checked)}
            />
            Show on homepage
          </label>

          {error && <p className="dialog-error">{error}</p>}
          <div className="dialog-actions">
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? 'Saving…' : 'Add Sponsor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Manage Sponsor Dialog ───────────────────────────────────────────────────

function ManageSponsorDialog({ sponsorId, onClose, onUpdated, onDeleted }) {
  const [sponsor, setSponsor] = useState(null);
  const [activeTab, setActiveTab] = useState('details');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadSponsor = useCallback(async () => {
    try {
      const s = await apiFetch(`/api/sponsors/${sponsorId}`);
      setSponsor(s);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [sponsorId]);

  useEffect(() => {
    loadSponsor();
  }, [loadSponsor]);

  function handleLogoUpdated(size, url) {
    setSponsor((prev) => ({
      ...prev,
      [`logo_${size}_url`]: url,
    }));
    onUpdated({ ...sponsor, [`logo_${size}_url`]: url });
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="dialog dialog--wide" onClick={(e) => e.stopPropagation()}>
        <div className="dialog-header">
          <h2 className="dialog-title">
            {loading ? 'Loading…' : sponsor?.name}
            {sponsor && <TierBadge tier={sponsor.tier} />}
          </h2>
          <button className="dialog-close" onClick={onClose}>
            ✕
          </button>
        </div>

        {loading ? (
          <p className="loading-text" style={{ padding: '1.5rem' }}>Loading…</p>
        ) : error ? (
          <p className="page-error" style={{ margin: '1rem 1.5rem' }}>{error}</p>
        ) : (
          <>
            <div className="tab-bar">
              {['details', 'media'].map((tab) => (
                <button
                  key={tab}
                  className={`tab-btn${activeTab === tab ? ' tab-btn--active' : ''}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab === 'details' ? 'Details' : 'Media Pack'}
                </button>
              ))}
            </div>

            <div className="tab-content">
              {activeTab === 'details' && (
                <DetailsTab
                  sponsor={sponsor}
                  onUpdated={(updated) => {
                    setSponsor(updated);
                    onUpdated(updated);
                  }}
                  onDeleted={() => onDeleted(sponsorId)}
                />
              )}
              {activeTab === 'media' && (
                <MediaTab sponsor={sponsor} onLogoUpdated={handleLogoUpdated} />
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Details Tab ─────────────────────────────────────────────────────────────

function DetailsTab({ sponsor, onUpdated, onDeleted }) {
  const [form, setForm] = useState({
    name: sponsor.name || '',
    tier: sponsor.tier || 'general',
    website_url: sponsor.website_url || '',
    contact_name: sponsor.contact_name || '',
    contact_email: sponsor.contact_email || '',
    contact_phone: sponsor.contact_phone || '',
    description: sponsor.description || '',
    show_on_homepage: Boolean(sponsor.show_on_homepage),
    is_active: sponsor.is_active !== 0,
  });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
    setSuccess('');
  }

  async function handleSave(e) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      const updated = await apiFetch(`/api/sponsors/${sponsor.id}`, {
        method: 'PUT',
        body: JSON.stringify(form),
      });
      onUpdated(updated);
      setSuccess('Saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/sponsors/${sponsor.id}`, { method: 'DELETE' });
      onDeleted();
    } catch (err) {
      setError(err.message);
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  return (
    <form onSubmit={handleSave} className="tab-section">
      <label className="field-label">
        Sponsor Name *
        <input
          className="field-input"
          type="text"
          value={form.name}
          onChange={(e) => set('name', e.target.value)}
          required
        />
      </label>

      <label className="field-label">
        Tier *
        <select
          className="field-input"
          value={form.tier}
          onChange={(e) => set('tier', e.target.value)}
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {TIER_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className="field-label">
        Website URL
        <input
          className="field-input"
          type="url"
          value={form.website_url}
          onChange={(e) => set('website_url', e.target.value)}
          placeholder="https://example.com"
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
        Description
        <textarea
          className="field-input field-textarea"
          value={form.description}
          onChange={(e) => set('description', e.target.value)}
          rows={3}
        />
      </label>

      <div className="field-checkboxes">
        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={form.show_on_homepage}
            onChange={(e) => set('show_on_homepage', e.target.checked)}
          />
          Show on homepage
        </label>
        <label className="field-checkbox">
          <input
            type="checkbox"
            checked={form.is_active}
            onChange={(e) => set('is_active', e.target.checked)}
          />
          Active
        </label>
      </div>

      {error && <p className="field-error">{error}</p>}
      {success && <p className="field-success">{success}</p>}

      <div className="dialog-actions dialog-actions--spread">
        <div>
          {confirmDelete ? (
            <div className="delete-confirm">
              <span className="delete-confirm-text">Delete this sponsor?</span>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={handleDelete}
                disabled={deleting}
              >
                {deleting ? 'Deleting…' : 'Yes, delete'}
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setConfirmDelete(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              style={{ color: '#dc2626' }}
              onClick={() => setConfirmDelete(true)}
            >
              Delete sponsor
            </button>
          )}
        </div>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}

// ─── Media Tab ───────────────────────────────────────────────────────────────

function MediaTab({ sponsor, onLogoUpdated }) {
  return (
    <div className="tab-section">
      <p className="media-intro">
        Upload logo images in three sizes for use across the site and in print materials.
      </p>
      <div className="logo-slots">
        {LOGO_SIZES.map((size) => (
          <LogoSlot
            key={size}
            sponsorId={sponsor.id}
            size={size}
            currentUrl={sponsor[`logo_${size}_url`]}
            onUpdated={onLogoUpdated}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Sponsor Card ────────────────────────────────────────────────────────────

function SponsorCard({ sponsor, onManage }) {
  const logo = sponsor.logo_small_url || sponsor.logo_medium_url || sponsor.logo_large_url;

  return (
    <div className="sponsor-card" onClick={() => onManage(sponsor.id)}>
      <div className="sponsor-card-logo">
        {logo ? (
          <img src={logo} alt={`${sponsor.name} logo`} className="sponsor-logo-img" />
        ) : (
          <div className="sponsor-logo-placeholder">No logo</div>
        )}
      </div>
      <div className="sponsor-card-body">
        <div className="sponsor-card-header">
          <span className="sponsor-name">{sponsor.name}</span>
          <TierBadge tier={sponsor.tier} />
        </div>
        {sponsor.website_url && (
          <a
            href={sponsor.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="sponsor-website"
            onClick={(e) => e.stopPropagation()}
          >
            {sponsor.website_url.replace(/^https?:\/\//, '')}
          </a>
        )}
        <div className="sponsor-card-meta">
          {!sponsor.is_active && <span className="badge-inactive">Inactive</span>}
          {Boolean(sponsor.show_on_homepage) && (
            <span className="badge-homepage">On homepage</span>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function SponsorsPage() {
  const { user } = useAuth();
  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const canEdit = roles.includes('admin') || roles.includes('committee');

  const [sponsors, setSponsors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [managingId, setManagingId] = useState(null);
  const [filterTier, setFilterTier] = useState('all');

  const loadSponsors = useCallback(() => {
    setLoading(true);
    apiFetch('/api/sponsors')
      .then(setSponsors)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    loadSponsors();
  }, [loadSponsors]);

  function handleCreated(sponsor) {
    setSponsors((prev) => [...prev, sponsor]);
    setShowCreate(false);
  }

  function handleUpdated(updated) {
    setSponsors((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }

  function handleDeleted(id) {
    setSponsors((prev) => prev.filter((s) => s.id !== id));
    setManagingId(null);
  }

  const displayed =
    filterTier === 'all' ? sponsors : sponsors.filter((s) => s.tier === filterTier);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">Sponsors</h1>
          <p className="page-subtitle">
            Manage club sponsors, media packs, and homepage visibility
          </p>
        </div>
        {canEdit && (
          <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
            + Add Sponsor
          </button>
        )}
      </div>

      <div className="sponsors-filter-bar">
        <span className="filter-label">Filter by tier:</span>
        {['all', ...TIERS].map((t) => (
          <button
            key={t}
            className={`filter-btn${filterTier === t ? ' filter-btn--active' : ''}`}
            onClick={() => setFilterTier(t)}
          >
            {t === 'all' ? 'All' : TIER_LABELS[t]}
          </button>
        ))}
      </div>

      {error && <p className="page-error">{error}</p>}

      {loading ? (
        <p className="loading-text">Loading sponsors…</p>
      ) : displayed.length === 0 ? (
        <p className="empty-text">
          {filterTier === 'all' ? 'No sponsors yet.' : `No ${TIER_LABELS[filterTier]} sponsors.`}
        </p>
      ) : (
        <div className="sponsors-grid">
          {displayed.map((s) => (
            <SponsorCard key={s.id} sponsor={s} onManage={setManagingId} />
          ))}
        </div>
      )}

      {showCreate && (
        <CreateSponsorDialog onClose={() => setShowCreate(false)} onCreated={handleCreated} />
      )}

      {managingId && (
        <ManageSponsorDialog
          sponsorId={managingId}
          onClose={() => setManagingId(null)}
          onUpdated={handleUpdated}
          onDeleted={handleDeleted}
        />
      )}
    </div>
  );
}
