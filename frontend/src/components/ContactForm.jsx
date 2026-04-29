import { useState } from 'react';
import { useClub } from '../contexts/ClubContext';
import './ContactForm.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

export function ContactForm() {
  const { settings } = useClub();
  const enquiryTypes = settings.contact_enquiry_types || [];

  const [form, setForm] = useState({
    name: '',
    email: '',
    enquiry_type: enquiryTypes[0]?.label || '',
    message: '',
  });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  function set(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSending(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Request failed (${res.status})`);
      }
      setSent(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  }

  if (sent) {
    return (
      <div className="contact-form-success">
        <p className="contact-form-success-text">
          Thanks for getting in touch! We'll be in contact shortly.
        </p>
      </div>
    );
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <div className="contact-form-row">
        <label className="contact-form-label">
          Your name
          <input
            className="contact-form-input"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            required
          />
        </label>
        <label className="contact-form-label">
          Your email
          <input
            className="contact-form-input"
            type="email"
            value={form.email}
            onChange={(e) => set('email', e.target.value)}
            required
          />
        </label>
      </div>

      {enquiryTypes.length > 1 && (
        <label className="contact-form-label">
          Enquiry type
          <select
            className="contact-form-input"
            value={form.enquiry_type}
            onChange={(e) => set('enquiry_type', e.target.value)}
          >
            {enquiryTypes.map((t) => (
              <option key={t.label} value={t.label}>{t.label}</option>
            ))}
          </select>
        </label>
      )}

      <label className="contact-form-label">
        Message
        <textarea
          className="contact-form-input contact-form-textarea"
          rows={5}
          value={form.message}
          onChange={(e) => set('message', e.target.value)}
          required
        />
      </label>

      {error && <p className="contact-form-error">{error}</p>}

      <button type="submit" className="btn btn-primary" disabled={sending}>
        {sending ? 'Sending…' : 'Send Message'}
      </button>
    </form>
  );
}
