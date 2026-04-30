import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useClub } from '../contexts/ClubContext';
import { EOIFormDialog } from '../components/EOIFormDialog';
import { ContactForm } from '../components/ContactForm';
import './HomePage.css';

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TwitterIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.747l7.73-8.835L1.254 2.25H8.08l4.259 5.631L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z" />
    </svg>
  );
}

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.34 6.34 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.87a8.15 8.15 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1-.31z" />
    </svg>
  );
}

const SOCIAL_PLATFORMS = [
  { key: 'social_facebook',  label: 'Facebook',   Icon: FacebookIcon  },
  { key: 'social_instagram', label: 'Instagram',  Icon: InstagramIcon },
  { key: 'social_twitter',   label: 'Twitter / X', Icon: TwitterIcon  },
  { key: 'social_tiktok',    label: 'TikTok',     Icon: TikTokIcon    },
];

const API_BASE = import.meta.env.VITE_API_URL || '';

function StatCard({ value, label }) {
  return (
    <div className="stat-card">
      <span className="stat-value">{value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

// ─── Sponsor card used on the homepage ───────────────────────────────────────

function HomeSponsorCard({ sponsor }) {
  const logo =
    sponsor.logo_medium_url || sponsor.logo_large_url || sponsor.logo_small_url;
  const card = (
    <div className="home-sponsor-card">
      {logo ? (
        <img src={logo} alt={sponsor.name} className="home-sponsor-logo" />
      ) : (
        <span className="home-sponsor-name">{sponsor.name}</span>
      )}
    </div>
  );
  return sponsor.website_url ? (
    <a
      href={sponsor.website_url}
      target="_blank"
      rel="noopener noreferrer"
      className="home-sponsor-link"
    >
      {card}
    </a>
  ) : (
    card
  );
}

// Auto-rotating carousel for silver + bronze sponsors
function SponsorCarousel({ sponsors }) {
  const VISIBLE = 4;
  const [startIdx, setStartIdx] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    if (sponsors.length <= VISIBLE) return;
    timerRef.current = setInterval(() => {
      setStartIdx((i) => (i + 1) % sponsors.length);
    }, 3000);
    return () => clearInterval(timerRef.current);
  }, [sponsors.length]);

  const visible = [];
  for (let i = 0; i < Math.min(VISIBLE, sponsors.length); i++) {
    visible.push(sponsors[(startIdx + i) % sponsors.length]);
  }

  return (
    <div className="sponsor-carousel">
      {visible.map((s) => (
        <HomeSponsorCard key={s.id} sponsor={s} />
      ))}
    </div>
  );
}

export function HomePage() {
  const { settings } = useClub();
  const [stats, setStats] = useState(null);
  const [showEOI, setShowEOI] = useState(false);
  const [sponsors, setSponsors] = useState([]);

  useEffect(() => {
    fetch(`${API_BASE}/api/homepage-stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/sponsors/public`)
      .then((r) => r.json())
      .then(setSponsors)
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

      {/* Sponsors */}
      {sponsors.length > 0 && (() => {
        const gold = sponsors.filter((s) => s.tier === 'gold');
        const rotating = sponsors.filter((s) => s.tier === 'silver' || s.tier === 'bronze');
        return (
          <section className="sponsors-section" id="sponsors">
            <div className="section-inner sponsors-inner">
              <h2 className="section-heading sponsors-heading">Our Sponsors</h2>
              {gold.length > 0 && (
                <div className="sponsors-gold-row">
                  {gold.map((s) => (
                    <HomeSponsorCard key={s.id} sponsor={s} />
                  ))}
                </div>
              )}
              {rotating.length > 0 && (
                <div className="sponsors-rotating-row">
                  <SponsorCarousel sponsors={rotating} />
                </div>
              )}
            </div>
          </section>
        );
      })()}

      {/* About */}
      <section className="about" id="about">
        <div className="section-inner about-inner">
          <div className="about-text">
            <h2 className="section-heading">About us</h2>
            <div className="about-body" dangerouslySetInnerHTML={{ __html: settings.about_text }} />
            {SOCIAL_PLATFORMS.some(p => settings[p.key]) && (
              <div className="about-social">
                {SOCIAL_PLATFORMS.filter(p => settings[p.key]).map(({ key, label, Icon }) => (
                  <a
                    key={key}
                    href={settings[key]}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="social-icon-link"
                    aria-label={label}
                  >
                    <Icon />
                  </a>
                ))}
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
