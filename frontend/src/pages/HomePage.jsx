import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useClub } from '../contexts/ClubContext';
import { EOIFormDialog } from '../components/EOIFormDialog';
import { ContactForm } from '../components/ContactForm';
import './HomePage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export function HomePage() {
  const { settings } = useClub();
  const [stats, setStats] = useState(null);
  const [showEOI, setShowEOI] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/homepage-stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <div className="homepage">
      {/* Hero */}
      <section
        className="hero"
        style={
          settings.hero_image_url
            ? { backgroundImage: `url(${settings.hero_image_url})` }
            : {}
        }
      >
        <div className="hero-overlay" />
        <div className="hero-content">
          <h1 className="hero-title">{settings.club_name}</h1>
          <p className="hero-mission">{settings.mission_statement}</p>
          <button
            className="btn btn-accent btn-lg"
            onClick={() => setShowEOI(true)}
          >
            Register Your Interest
          </button>
        </div>
      </section>

      {/* Stats bar */}
      {stats && (
        <section className="stats-bar">
          <StatCard value={stats.active_players} label="Active Players" />
          <div className="stats-divider" />
          <StatCard value={stats.active_teams} label="Teams" />
          <div className="stats-divider" />
          <StatCard value={stats.coaches_and_staff} label="Coaches & Staff" />
        </section>
      )}

      {/* About */}
      <section className="about" id="about">
        <div className="section-inner about-inner">
          <div className="about-text">
            <h2 className="section-heading">About us</h2>
            <div className="about-body" dangerouslySetInnerHTML={{ __html: settings.about_text }} />
          </div>

          {settings.about_image_url && (
            <div className="about-image-wrap">
              <img
                src={settings.about_image_url}
                alt="About the club"
                className="about-image"
              />
            </div>
          )}
        </div>
      </section>

      {/* Contact */}
      <section className="contact-section" id="contact">
        <div className="section-inner contact-section-inner">
          <h2 className="section-heading">Get in touch</h2>

          <div className="contact-details">
            {settings.contact_phone && (
              <p className="contact-line">
                <span className="contact-icon">📞</span>
                <a href={`tel:${settings.contact_phone}`}>{settings.contact_phone}</a>
              </p>
            )}
            {settings.contact_email && (
              <p className="contact-line">
                <span className="contact-icon">✉️</span>
                <a href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>
              </p>
            )}
            {settings.contact_address && (
              <p className="contact-line">
                <span className="contact-icon">📍</span>
                {settings.contact_address}
              </p>
            )}
          </div>

          <ContactForm />
        </div>
      </section>

      <footer className="footer">
        <p>© {new Date().getFullYear()} {settings.club_name}. All rights reserved.</p>
        <p className="footer-platform">
          Powered by <Link to="/platform" className="footer-platform-link">CourtAdmin</Link>
        </p>
      </footer>

      {showEOI && <EOIFormDialog onClose={() => setShowEOI(false)} />}
    </div>
  );
}
