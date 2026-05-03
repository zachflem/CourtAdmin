import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useClub } from '../contexts/ClubContext';
import { useNotifications } from '../contexts/NotificationsContext';
import './NavBar.css';

function NotifBadge({ count }) {
  if (!count) return null;
  return <span className="notif-badge">{count > 99 ? '99+' : count}</span>;
}

export function NavBar() {
  const { user, loading, isMocking, mockRole, setMockRole } = useAuth();
  const { settings } = useClub();
  const { counts } = useNotifications();
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

  // Per-link counts (role-aware)
  const messagesCount = counts.unread_messages + counts.pending_eois;
  const usersCount = counts.pending_role_requests;
  const docsCount = counts.pending_doc_acks;

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
                  className="btn btn-primary btn-sm manage-btn"
                  onClick={() => setMenuOpen((o) => !o)}
                  aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                  aria-expanded={menuOpen}
                >
                  Manage
                  {counts.total > 0 && !menuOpen && (
                    <span className="hamburger-dot" aria-hidden="true" />
                  )}
                </button>

                {menuOpen && (
                  <div className="hamburger-menu">
                    {isStaff && (
                      <>
                        <Link to="/email" className="menu-link menu-link--badged">
                          Messages <NotifBadge count={messagesCount} />
                        </Link>
                        <div className="menu-divider" />
                        <Link to="/players" className="menu-link">Players</Link>
                        <Link to="/teams" className="menu-link">Teams</Link>
                        <div className="menu-divider" />
                        <Link to="/venues" className="menu-link">Venues</Link>
                        <Link to="/sponsors" className="menu-link">Sponsors</Link>
                        <Link to="/documents" className="menu-link menu-link--badged">
                          Documents <NotifBadge count={docsCount} />
                        </Link>
                        <Link to="/users" className="menu-link menu-link--badged">
                          Users <NotifBadge count={usersCount} />
                        </Link>
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
                        <Link to="/venues" className="menu-link">Venues</Link>
                        <Link to="/documents" className="menu-link menu-link--badged">
                          Documents <NotifBadge count={docsCount} />
                        </Link>
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
