import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import './NavBar.css';

function HamburgerIcon({ open }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 22 22"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      aria-hidden="true"
    >
      {open ? (
        <>
          <line x1="4" y1="4" x2="18" y2="18" />
          <line x1="18" y1="4" x2="4" y2="18" />
        </>
      ) : (
        <>
          <line x1="3" y1="6" x2="19" y2="6" />
          <line x1="3" y1="11" x2="19" y2="11" />
          <line x1="3" y1="16" x2="19" y2="16" />
        </>
      )}
    </svg>
  );
}

export function NavBar() {
  const { user, loading, isMocking, mockRole, setMockRole } = useAuth();
  const { settings } = useClub();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const roles = user ? JSON.parse(user.roles || '[]') : [];
  const isStaff = roles.includes('admin') || roles.includes('committee');
  const isCoachOrManager = roles.includes('coach') || roles.includes('manager');
  const isAdmin = roles.includes('admin');

  // Close menu when navigating
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const hasMenu = isStaff || isCoachOrManager;

  return (
    <>
      <nav className="navbar">
        <div className="navbar-inner">
          {/* Brand */}
          <Link to="/" className="navbar-brand">
            <img src={settings.logo_url || '/logo.png'} alt="" className="navbar-app-icon" />
            <span className="navbar-club-name">{settings.club_name || 'CourtAdmin'}</span>
          </Link>

          {/* Public links — always visible */}
          <div className="navbar-links">
            <a href="/#about" className="navbar-link">About</a>
            <a href="/#contact" className="navbar-link">Contact</a>
          </div>

          {/* Right-side actions */}
          <div className="navbar-actions">
            {!loading && (
              user ? (
                <Link to="/dashboard" className="btn btn-primary btn-sm">
                  Dashboard
                </Link>
              ) : (
                <a href="/cdn-cgi/access/login" className="btn btn-primary btn-sm">
                  Sign In
                </a>
              )
            )}

            {hasMenu && (
              <div className="hamburger-wrap" ref={menuRef}>
                <button
                  className="hamburger-btn"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={menuOpen}
                >
                  <HamburgerIcon open={menuOpen} />
                </button>

                {menuOpen && (
                  <div className="hamburger-menu">
                    {isStaff && (
                      <>
                        <p className="menu-section-label">Manage</p>
                        <Link to="/seasons" className="menu-link">Seasons</Link>
                        <Link to="/teams" className="menu-link">Teams</Link>
                        <Link to="/venues" className="menu-link">Venues</Link>
                        <Link to="/players" className="menu-link">Players</Link>
                        <Link to="/sponsors" className="menu-link">Sponsors</Link>
                        <Link to="/email" className="menu-link">Messages</Link>
                        {isAdmin && (
                          <>
                            <div className="menu-divider" />
                            <Link to="/settings" className="menu-link">Settings</Link>
                          </>
                        )}
                      </>
                    )}
                    {!isStaff && isCoachOrManager && (
                      <>
                        <p className="menu-section-label">My Club</p>
                        <Link to="/venues" className="menu-link">Venues</Link>
                      </>
                    )}
                  </div>
                )}
              </div>
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
