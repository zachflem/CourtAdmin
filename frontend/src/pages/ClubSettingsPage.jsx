import { useState, useEffect } from 'react';
import { useClub } from '../contexts/ClubContext';
import { ImageUpload } from '../components/ImageUpload';
import './ClubSettingsPage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

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

export function ClubSettingsPage() {
  const { settings, setSettings } = useClub();

  const [form, setForm] = useState({
    club_name: '',
    mission_statement: '',
    about_text: '',
    contact_phone: '',
    contact_email: '',
    contact_address: '',
    primary_color: '#1e40af',
    secondary_color: '#3b82f6',
    accent_color: '#f59e0b',
  });
  const [ageGroups,    setAgeGroups]    = useState([]);
  const [newAgeGroup,  setNewAgeGroup]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Sync form from context when text/color fields change (not image URLs)
  useEffect(() => {
    setForm({
      club_name: settings.club_name || '',
      mission_statement: settings.mission_statement || '',
      about_text: settings.about_text || '',
      contact_phone: settings.contact_phone || '',
      contact_email: settings.contact_email || '',
      contact_address: settings.contact_address || '',
      primary_color: settings.primary_color || '#1e40af',
      secondary_color: settings.secondary_color || '#3b82f6',
      accent_color: settings.accent_color || '#f59e0b',
    });
  }, [
    settings.club_name,
    settings.mission_statement,
    settings.about_text,
    settings.contact_phone,
    settings.contact_email,
    settings.contact_address,
    settings.primary_color,
    settings.secondary_color,
    settings.accent_color,
  ]);

  useEffect(() => {
    if (Array.isArray(settings.age_groups)) {
      setAgeGroups(settings.age_groups);
    }
  }, [settings.age_groups]);

  function moveAgeGroup(index, direction) {
    setAgeGroups((prev) => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function removeAgeGroup(index) {
    setAgeGroups((prev) => prev.filter((_, i) => i !== index));
  }

  function addAgeGroup() {
    const name = newAgeGroup.trim();
    if (!name || ageGroups.includes(name)) return;
    setAgeGroups((prev) => [...prev, name]);
    setNewAgeGroup('');
  }

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
    // Live CSS variable preview for colors
    if (field === 'primary_color') document.documentElement.style.setProperty('--primary', value);
    else if (field === 'secondary_color') document.documentElement.style.setProperty('--secondary', value);
    else if (field === 'accent_color') document.documentElement.style.setProperty('--accent', value);
  }

  async function handleSave(e) {
    e.preventDefault();
    if (!form.club_name.trim()) {
      setError('Club name is required.');
      return;
    }
    setError('');
    setSuccess('');
    setSaving(true);
    try {
      if (ageGroups.length === 0) {
        setError('At least one age group is required.');
        setSaving(false);
        return;
      }
      const payload = {
        club_name: form.club_name.trim(),
        mission_statement: form.mission_statement,
        about_text: form.about_text,
        contact_phone: form.contact_phone,
        contact_email: form.contact_email,
        contact_address: form.contact_address,
        primary_color: form.primary_color,
        secondary_color: form.secondary_color,
        accent_color: form.accent_color,
        age_groups: ageGroups,
      };
      const updated = await apiFetch('/api/club-settings', {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setSettings(updated);
      setSuccess('Settings saved.');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function handleImageUpdate(field, url) {
    setSettings((prev) => ({ ...prev, [field]: url }));
  }

  return (
    <div className="cs-page">
      <div className="cs-page-header">
        <h1 className="cs-page-title">Club Settings</h1>
      </div>

      <form onSubmit={handleSave} className="cs-form">

        {/* ── Club Identity ── */}
        <section className="cs-section">
          <h2 className="cs-section-title">Club Identity</h2>

          <label className="cs-field-label">
            Club Name
            <input
              className="cs-input"
              value={form.club_name}
              onChange={(e) => set('club_name', e.target.value)}
              placeholder="e.g. Riverside Netball Club"
              required
            />
          </label>

          <label className="cs-field-label">
            Mission Statement
            <textarea
              className="cs-input cs-textarea"
              rows={2}
              value={form.mission_statement}
              onChange={(e) => set('mission_statement', e.target.value)}
              placeholder="Short tagline shown on the homepage hero"
            />
          </label>

          <label className="cs-field-label">
            About Text
            <textarea
              className="cs-input cs-textarea"
              rows={5}
              value={form.about_text}
              onChange={(e) => set('about_text', e.target.value)}
              placeholder="Longer description shown in the About section"
            />
          </label>
        </section>

        {/* ── Theme Colors ── */}
        <section className="cs-section">
          <h2 className="cs-section-title">Theme Colors</h2>
          <p className="cs-section-hint">Changes preview live — click Save to persist.</p>

          <div className="cs-color-row">
            <label className="cs-color-label">
              <input
                type="color"
                className="cs-color-input"
                value={form.primary_color}
                onChange={(e) => set('primary_color', e.target.value)}
              />
              <span>Primary</span>
              <code className="cs-color-hex">{form.primary_color}</code>
            </label>

            <label className="cs-color-label">
              <input
                type="color"
                className="cs-color-input"
                value={form.secondary_color}
                onChange={(e) => set('secondary_color', e.target.value)}
              />
              <span>Secondary</span>
              <code className="cs-color-hex">{form.secondary_color}</code>
            </label>

            <label className="cs-color-label">
              <input
                type="color"
                className="cs-color-input"
                value={form.accent_color}
                onChange={(e) => set('accent_color', e.target.value)}
              />
              <span>Accent</span>
              <code className="cs-color-hex">{form.accent_color}</code>
            </label>
          </div>
        </section>

        {/* ── Contact Information ── */}
        <section className="cs-section">
          <h2 className="cs-section-title">Contact Information</h2>

          <label className="cs-field-label">
            Phone
            <input
              className="cs-input"
              type="tel"
              value={form.contact_phone}
              onChange={(e) => set('contact_phone', e.target.value)}
              placeholder="e.g. (03) 9000 0000"
            />
          </label>

          <label className="cs-field-label">
            Email
            <input
              className="cs-input"
              type="email"
              value={form.contact_email}
              onChange={(e) => set('contact_email', e.target.value)}
              placeholder="e.g. admin@club.org.au"
            />
          </label>

          <label className="cs-field-label">
            Address
            <input
              className="cs-input"
              value={form.contact_address}
              onChange={(e) => set('contact_address', e.target.value)}
              placeholder="e.g. 42 Main St, Riverside VIC 3000"
            />
          </label>
        </section>

        {/* ── Age Groups ── */}
        <section className="cs-section">
          <h2 className="cs-section-title">Age Groups</h2>
          <p className="cs-section-hint">
            Defines the selectable age groups across teams, players, and email targeting.
            Order determines jersey-number conflict checking (adjacent groups share a pool).
          </p>

          {ageGroups.length === 0 && (
            <p className="cs-age-empty">No age groups defined. Add at least one below.</p>
          )}

          <ol className="cs-age-list">
            {ageGroups.map((ag, i) => (
              <li key={ag} className="cs-age-row">
                <span className="cs-age-name">{ag}</span>
                <div className="cs-age-actions">
                  <button
                    type="button"
                    className="cs-icon-btn"
                    onClick={() => moveAgeGroup(i, -1)}
                    disabled={i === 0}
                    title="Move up"
                  >↑</button>
                  <button
                    type="button"
                    className="cs-icon-btn"
                    onClick={() => moveAgeGroup(i, 1)}
                    disabled={i === ageGroups.length - 1}
                    title="Move down"
                  >↓</button>
                  <button
                    type="button"
                    className="cs-icon-btn cs-icon-btn--danger"
                    onClick={() => removeAgeGroup(i)}
                    title="Remove"
                  >×</button>
                </div>
              </li>
            ))}
          </ol>

          <div className="cs-age-add">
            <input
              className="cs-input cs-age-input"
              placeholder="New age group name, e.g. U12 or Masters"
              value={newAgeGroup}
              onChange={(e) => setNewAgeGroup(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addAgeGroup(); } }}
            />
            <button
              type="button"
              className="cs-btn cs-btn-secondary"
              onClick={addAgeGroup}
              disabled={!newAgeGroup.trim() || ageGroups.includes(newAgeGroup.trim())}
            >
              Add
            </button>
          </div>
        </section>

        {error && <p className="cs-error">{error}</p>}
        {success && <p className="cs-success">{success}</p>}

        <div className="cs-form-actions">
          <button type="submit" className="cs-btn cs-btn-primary" disabled={saving}>
            {saving ? 'Saving…' : 'Save Settings'}
          </button>
        </div>
      </form>

      {/* ── Images (each upload saves immediately via its own endpoint) ── */}
      <section className="cs-section">
        <h2 className="cs-section-title">Images</h2>
        <p className="cs-section-hint">Uploads save immediately.</p>

        <div className="cs-image-grid">
          <div className="cs-image-slot">
            <ImageUpload
              slot="logo"
              label="Club Logo"
              currentUrl={settings.logo_url}
              onUpdate={(url) => handleImageUpdate('logo_url', url)}
            />
          </div>

          <div className="cs-image-slot">
            <ImageUpload
              slot="hero-image"
              label="Hero Image"
              currentUrl={settings.hero_image_url}
              onUpdate={(url) => handleImageUpdate('hero_image_url', url)}
            />
          </div>

          <div className="cs-image-slot">
            <ImageUpload
              slot="about-image"
              label="About Image"
              currentUrl={settings.about_image_url}
              onUpdate={(url) => handleImageUpdate('about_image_url', url)}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
