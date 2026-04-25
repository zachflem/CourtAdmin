import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './NavBar.css';

export function NavBar() {
  const { user, loading } = useAuth();
  const { settings } = useClub();

  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const isStaff = roles.includes('admin') || roles.includes('committee');

  return (
    <nav className="navbar">
      <div className="navbar-inner">
        <Link to="/" className="navbar-brand">
          {settings.logo_url ? (
            <img src={settings.logo_url} alt={settings.club_name} className="navbar-logo" />
          ) : null}
          <span className="navbar-club-name">{settings.club_name}</span>
        </Link>

        <div className="navbar-links">
          <a href="#about" className="navbar-link">About</a>
          <a href="#contact" className="navbar-link">Contact</a>
          {isStaff && (
            <>
              <Link to="/seasons" className="navbar-link">Seasons</Link>
              <Link to="/teams" className="navbar-link">Teams</Link>
              <Link to="/players" className="navbar-link">Players</Link>
            </>
          )}
        </div>

        <div className="navbar-actions">
          {loading ? null : user ? (
            <Link to="/dashboard" className="btn btn-primary btn-sm">
              Dashboard
            </Link>
          ) : (
            <a href="/cdn-cgi/access/login" className="btn btn-primary btn-sm">
              Sign In
            </a>
          )}
        </div>
      </div>
    </nav>
  );
}
