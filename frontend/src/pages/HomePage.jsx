import { useEffect, useState } from 'react';
import { useClub } from '../contexts/ClubContext';
import './HomePage.css';

const API_BASE = import.meta.env.VITE_API_URL || '';

const FEATURES = [
  {
    icon: '📋',
    title: 'Easy Registration',
    description:
      'Submit an Expression of Interest online in minutes. Our streamlined process gets new players registered and onto the field fast.',
  },
  {
    icon: '👥',
    title: 'Team Management',
    description:
      'Coaches and managers have everything they need — rosters, player details, and contact information all in one place.',
  },
  {
    icon: '📊',
    title: 'Player Development',
    description:
      'Track progress with structured coaching feedback. Players and parents can view personalised development notes any time.',
  },
  {
    icon: '📧',
    title: 'Club Communication',
    description:
      'Keep the whole club informed with targeted email campaigns. Reach players, coaches, or the whole membership at once.',
  },
];

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

function FeatureCard({ icon, title, description }) {
  return (
    <div className="feature-card">
      <div className="feature-icon">{icon}</div>
      <h3 className="feature-title">{title}</h3>
      <p className="feature-desc">{description}</p>
    </div>
  );
}

export function HomePage() {
  const { settings } = useClub();
  const [stats, setStats] = useState(null);

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
          <a href="#eoi" className="btn btn-accent btn-lg">
            Register Your Interest
          </a>
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

      {/* Features */}
      <section className="features" id="features">
        <div className="section-inner">
          <h2 className="section-heading">Everything your club needs</h2>
          <p className="section-subheading">
            Built for administrators, coaches, and players — all roles in one platform.
          </p>
          <div className="features-grid">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* About */}
      <section className="about" id="about">
        <div className="section-inner about-inner">
          <div className="about-text">
            <h2 className="section-heading">About us</h2>
            <p className="about-body">{settings.about_text}</p>

            {(settings.contact_phone || settings.contact_email || settings.contact_address) && (
              <div className="contact-block" id="contact">
                <h3 className="contact-heading">Get in touch</h3>
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
            )}
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

      <footer className="footer">
        <p>© {new Date().getFullYear()} {settings.club_name}. All rights reserved.</p>
      </footer>
    </div>
  );
}
