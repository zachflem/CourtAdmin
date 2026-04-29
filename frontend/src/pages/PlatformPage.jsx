import { Link } from 'react-router-dom';
import './PlatformPage.css';

const FEATURES = [
  {
    icon: '📋',
    title: 'Online Registration',
    description:
      'Families submit an Expression of Interest in minutes. Age groups, jersey numbers, and team placement are all handled in one workflow.',
  },
  {
    icon: '👥',
    title: 'Team & Roster Management',
    description:
      'Build teams, assign coaches and managers, and keep rosters up to date throughout the season — all in one place.',
  },
  {
    icon: '📊',
    title: 'Player Development Tracking',
    description:
      'Coaches write structured feedback that players and parents can read any time. Progress is tracked across seasons.',
  },
  {
    icon: '📧',
    title: 'Targeted Communications',
    description:
      'Send email campaigns to specific roles, age groups, or teams. Reusable templates keep messaging consistent.',
  },
  {
    icon: '🔒',
    title: 'Role-Based Access',
    description:
      'Admins, committee members, coaches, managers, players, and parents each see exactly what they need — nothing more.',
  },
  {
    icon: '💬',
    title: 'Contact & Enquiries',
    description:
      'A public contact form routes enquiries to the right person automatically. Every message is stored in the admin inbox.',
  },
];

function FeatureCard({ icon, title, description }) {
  return (
    <div className="platform-feature-card">
      <div className="platform-feature-icon">{icon}</div>
      <h3 className="platform-feature-title">{title}</h3>
      <p className="platform-feature-desc">{description}</p>
    </div>
  );
}

export function PlatformPage() {
  return (
    <div className="platform-page">

      {/* Hero */}
      <section className="platform-hero">
        <img src="/logo.png" alt="CourtAdmin" className="platform-logo" />
        <h1 className="platform-hero-title">CourtAdmin</h1>
        <p className="platform-hero-tagline">
          Club management software built for the way sports clubs actually work.
        </p>
        <p className="platform-hero-sub">
          From registration to end-of-season, CourtAdmin gives administrators,
          coaches, and families one place for everything.
        </p>
      </section>

      {/* Features */}
      <section className="platform-features">
        <div className="platform-inner">
          <h2 className="platform-section-heading">Everything a club needs</h2>
          <p className="platform-section-sub">
            Designed around the real workflows of community sports clubs — not enterprise software adapted to fit.
          </p>
          <div className="platform-features-grid">
            {FEATURES.map((f) => (
              <FeatureCard key={f.title} {...f} />
            ))}
          </div>
        </div>
      </section>

      {/* Who it's for */}
      <section className="platform-roles">
        <div className="platform-inner platform-roles-inner">
          <div className="platform-roles-text">
            <h2 className="platform-section-heading">Built for every role</h2>
            <p className="platform-roles-body">
              CourtAdmin gives each person in your club exactly what they need.
              Admins manage the whole club. Committee members process registrations
              and send communications. Coaches track their squads and write feedback.
              Players and parents see their own information, teams, and development notes.
            </p>
            <p className="platform-roles-body">
              Access is controlled automatically — no manual permission management,
              no shared passwords.
            </p>
          </div>
          <div className="platform-roles-list">
            {['Admin', 'Committee', 'Coach', 'Manager', 'Player', 'Parent'].map((role) => (
              <span key={role} className="platform-role-chip">{role}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="platform-footer">
        <Link to="/" className="platform-footer-link">← Back to club homepage</Link>
        <p className="platform-footer-copy">CourtAdmin — built for community sport.</p>
      </footer>

    </div>
  );
}
