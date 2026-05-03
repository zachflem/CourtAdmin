import { useState, useEffect } from 'react';
import './EOIFormDialog.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const GENDER_OPTIONS = ['Male', 'Female', 'Other'];
const EXPERIENCE_OPTIONS = ['No experience', '1–2 years', '3–5 years', '5+ years'];

function calculateAge(dob) {
  if (!dob) return null;
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

const EMPTY = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  date_of_birth: '',
  gender: '',
  experience_level: '',
  season_interest: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
  additional_notes: '',
  clearance_required: false,
  previous_club_name: '',
  previous_team_name: '',
  previous_coach_name: '',
  parent_guardian_name: '',
  parent_guardian_email: '',
  parent_guardian_phone: '',
  relationship_to_player: '',
};

export function EOIFormDialog({ onClose }) {
  const [form, setForm] = useState(EMPTY);
  const [seasons, setSeasons] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const age = calculateAge(form.date_of_birth);
  const isMinor = age !== null && age < 18;

  useEffect(() => {
    fetch(`${API_BASE}/api/seasons/available`)
      .then((r) => r.json())
      .then(setSeasons)
      .catch(() => {});
  }, []);

  function set(field, value) {
    setForm((f) => ({ ...f, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        // For minors, parent details serve as emergency contact
        emergency_contact_name: isMinor ? form.parent_guardian_name : form.emergency_contact_name,
        emergency_contact_phone: isMinor ? form.parent_guardian_phone : form.emergency_contact_phone,
        // Strip parent fields for adults
        parent_guardian_name: isMinor ? form.parent_guardian_name : undefined,
        parent_guardian_email: isMinor ? form.parent_guardian_email : undefined,
        parent_guardian_phone: isMinor ? form.parent_guardian_phone : undefined,
        relationship_to_player: isMinor ? form.relationship_to_player : undefined,
        // Strip clearance details when not required
        previous_club_name: form.clearance_required ? form.previous_club_name : undefined,
        previous_team_name: form.clearance_required ? form.previous_team_name : undefined,
        previous_coach_name: form.clearance_required ? form.previous_coach_name : undefined,
      };

      const res = await fetch(`${API_BASE}/api/eoi`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Submission failed (${res.status})`);
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <div className="dialog-backdrop" onClick={onClose}>
        <div className="eoi-dialog" onClick={(e) => e.stopPropagation()}>
          <div className="eoi-success">
            <div className="eoi-success-icon">✓</div>
            <h2 className="eoi-success-title">Application Received!</h2>
            <p className="eoi-success-body">
              Thank you for your interest. We've sent a confirmation to{' '}
              <strong>{form.email || form.parent_guardian_email}</strong> and will be in touch soon.
            </p>
            <button className="btn btn-primary" onClick={onClose}>
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="dialog-backdrop" onClick={onClose}>
      <div className="eoi-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="eoi-header">
          <h2 className="eoi-title">Register Your Interest</h2>
          <button className="eoi-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="eoi-form">
          {/* Personal Details */}
          <section className="eoi-section">
            <h3 className="eoi-section-title">Personal Details</h3>

            <div className="field-row">
              <label className="field-label">
                <span>First Name <span className="req">*</span></span>
                <input
                  className="field-input"
                  type="text"
                  value={form.first_name}
                  onChange={(e) => set('first_name', e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                <span>Last Name <span className="req">*</span></span>
                <input
                  className="field-input"
                  type="text"
                  value={form.last_name}
                  onChange={(e) => set('last_name', e.target.value)}
                  required
                />
              </label>
            </div>

            <div className="field-row">
              <label className="field-label">
                <span>Date of Birth <span className="req">*</span></span>
                <input
                  className="field-input"
                  type="date"
                  value={form.date_of_birth}
                  onChange={(e) => set('date_of_birth', e.target.value)}
                  required
                />
              </label>
              <label className="field-label">
                <span>Gender <span className="req">*</span></span>
                <select
                  className="field-input"
                  value={form.gender}
                  onChange={(e) => set('gender', e.target.value)}
                  required
                >
                  <option value="">Select…</option>
                  {GENDER_OPTIONS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* Age hint — always rendered to prevent layout shift */}
            <p className="field-age-hint">
              {age !== null
                ? `Age: ${age}${isMinor ? ' — parent / guardian details required below' : ''}`
                : ' '}
            </p>

            <div className="field-row">
              <label className="field-label">
                <span>
                  Email{' '}
                  {isMinor
                    ? <span className="field-label-optional">(optional)</span>
                    : <span className="req">*</span>}
                </span>
                <input
                  className="field-input"
                  type="email"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  required={!isMinor}
                />
              </label>
              <label className="field-label">
                <span>Phone</span>
                <input
                  className="field-input"
                  type="tel"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                />
              </label>
            </div>
          </section>

          {/* Playing Details */}
          <section className="eoi-section">
            <h3 className="eoi-section-title">Playing Details</h3>

            <label className="field-label">
              <span>Experience Level <span className="req">*</span></span>
              <select
                className="field-input"
                value={form.experience_level}
                onChange={(e) => set('experience_level', e.target.value)}
                required
              >
                <option value="">Select…</option>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </label>

            <label className="field-label">
              <span>Season Interest <span className="req">*</span></span>
              <select
                className="field-input"
                value={form.season_interest}
                onChange={(e) => set('season_interest', e.target.value)}
                required
              >
                <option value="">Select a season…</option>
                {seasons.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              {seasons.length === 0 && (
                <span className="field-hint">
                  No open seasons are available at this time.
                </span>
              )}
            </label>
          </section>

          {/* Emergency Contact (adults) OR Parent / Guardian (minors) */}
          {isMinor ? (
            <section className="eoi-section eoi-section--minor">
              <h3 className="eoi-section-title">
                Parent / Guardian
                <span className="eoi-minor-badge">Required — under 18</span>
              </h3>

              <div className="field-row">
                <label className="field-label">
                  <span>Name <span className="req">*</span></span>
                  <input
                    className="field-input"
                    type="text"
                    value={form.parent_guardian_name}
                    onChange={(e) => set('parent_guardian_name', e.target.value)}
                    required
                  />
                </label>
                <label className="field-label">
                  <span>Relationship <span className="req">*</span></span>
                  <input
                    className="field-input"
                    type="text"
                    value={form.relationship_to_player}
                    onChange={(e) => set('relationship_to_player', e.target.value)}
                    placeholder="e.g. Mother, Father, Guardian"
                    required
                  />
                </label>
              </div>

              <div className="field-row">
                <label className="field-label">
                  <span>Email <span className="req">*</span></span>
                  <input
                    className="field-input"
                    type="email"
                    value={form.parent_guardian_email}
                    onChange={(e) => set('parent_guardian_email', e.target.value)}
                    required
                  />
                </label>
                <label className="field-label">
                  <span>Phone <span className="req">*</span></span>
                  <input
                    className="field-input"
                    type="tel"
                    value={form.parent_guardian_phone}
                    onChange={(e) => set('parent_guardian_phone', e.target.value)}
                    required
                  />
                </label>
              </div>
            </section>
          ) : (
            <section className="eoi-section">
              <h3 className="eoi-section-title">Emergency Contact</h3>
              <div className="field-row">
                <label className="field-label">
                  <span>Name <span className="req">*</span></span>
                  <input
                    className="field-input"
                    type="text"
                    value={form.emergency_contact_name}
                    onChange={(e) => set('emergency_contact_name', e.target.value)}
                    required
                  />
                </label>
                <label className="field-label">
                  <span>Phone <span className="req">*</span></span>
                  <input
                    className="field-input"
                    type="tel"
                    value={form.emergency_contact_phone}
                    onChange={(e) => set('emergency_contact_phone', e.target.value)}
                    required
                  />
                </label>
              </div>
            </section>
          )}

          {/* Transfer Clearance */}
          <section className="eoi-section">
            <h3 className="eoi-section-title">Transfer Clearance</h3>
            <label className="eoi-checkbox-label">
              <input
                type="checkbox"
                checked={form.clearance_required}
                onChange={(e) => set('clearance_required', e.target.checked)}
              />
              I am transferring from another club and require a clearance
            </label>

            {form.clearance_required && (
              <div className="eoi-subsection">
                <div className="field-row">
                  <label className="field-label">
                    <span>Previous Club</span>
                    <input
                      className="field-input"
                      type="text"
                      value={form.previous_club_name}
                      onChange={(e) => set('previous_club_name', e.target.value)}
                    />
                  </label>
                  <label className="field-label">
                    <span>Previous Team</span>
                    <input
                      className="field-input"
                      type="text"
                      value={form.previous_team_name}
                      onChange={(e) => set('previous_team_name', e.target.value)}
                    />
                  </label>
                </div>
                <label className="field-label">
                  <span>Previous Coach</span>
                  <input
                    className="field-input"
                    type="text"
                    value={form.previous_coach_name}
                    onChange={(e) => set('previous_coach_name', e.target.value)}
                  />
                </label>
              </div>
            )}
          </section>

          {/* Additional Notes */}
          <section className="eoi-section">
            <label className="field-label">
              <span>Additional Notes</span>
              <textarea
                className="field-input field-textarea"
                value={form.additional_notes}
                onChange={(e) => set('additional_notes', e.target.value)}
                rows={3}
                placeholder="Anything else you'd like us to know…"
              />
            </label>
          </section>

          {error && <p className="dialog-error">{error}</p>}

          <div className="dialog-actions">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              disabled={submitting}
            >
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit Application'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
