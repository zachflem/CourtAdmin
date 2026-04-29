import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './NavBar.css';

export function NavBar() {
  const { user, loading, isMocking, mockRole, setMockRole } = useAuth();
  const { settings } = useClub();

  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const isStaff = roles.includes('admin') || roles.includes('committee');
  const isAdmin = roles.includes('admin');

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          <Link to="/" className="navbar-brand">
            <img src="/logo.png" alt="" className="navbar-app-icon" />
            <span className="navbar-club-name">{settings.club_name || 'CourtAdmin'}</span>
          </Link>

          <div className="navbar-links">
            <a href="#about" className="navbar-link">About</a>
            <a href="#contact" className="navbar-link">Contact</a>
            {isStaff && (
              <>
                <Link to="/seasons" className="navbar-link">Seasons</Link>
                <Link to="/teams" className="navbar-link">Teams</Link>
                <Link to="/players" className="navbar-link">Players</Link>
                <Link to="/email" className="navbar-link">Messages</Link>
                {isAdmin && (
                  <Link to="/settings" className="navbar-link">Settings</Link>
                )}
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
      {isMocking && (
        <div className="mock-role-banner">
          <span>Previewing as: <strong>{mockRole}</strong></span>
          <button onClick={() => setMockRole(null)} className="mock-role-banner-exit">
            Exit Preview
          </button>
        </div>
      )}
    </>
  );
}
