import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect, useCallback } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClubProvider } from './contexts/ClubContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NavBar } from './components/NavBar';
import { HomePage } from './pages/HomePage';
import { SeasonsPage } from './pages/SeasonsPage';
import { TeamsPage } from './pages/TeamsPage';
import { PlayersPage } from './pages/PlayersPage';

const API_BASE = import.meta.env.VITE_API_URL || '';
const ALL_ROLES = ['admin', 'committee', 'coach', 'manager', 'player', 'parent'];

async function apiFetch(path, opts = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...opts,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return res.json();
}

function parseRoles(s) {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

function RoleBadge({ role }) {
  return <span style={{
    display: 'inline-block',
    padding: '0.15rem 0.55rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: 600,
    background: '#eff6ff',
    color: '#1d4ed8',
    border: '1px solid #bfdbfe',
  }}>{role}</span>;
}

// ─── Role Request Form ────────────────────────────────────────────────────────

function RoleRequestSection({ user, onRequestSent }) {
  const currentRoles = parseRoles(user.roles);
  const available = ALL_ROLES.filter((r) => !currentRoles.includes(r));

  const [myRequests, setMyRequests] = useState([]);
  const [selected, setSelected] = useState([]);
  const [justification, setJustification] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchMyRequests = useCallback(() => {
    apiFetch('/api/role-requests/my')
      .then(setMyRequests)
      .catch(() => {});
  }, []);

  useEffect(() => { fetchMyRequests(); }, [fetchMyRequests]);

  const pendingRoles = myRequests
    .filter((r) => r.status === 'pending')
    .flatMap((r) => parseRoles(r.requested_roles));

  const requestable = available.filter((r) => !pendingRoles.includes(r));

  function toggleRole(role) {
    setSelected((prev) =>
      prev.includes(role) ? prev.filter((r) => r !== role) : [...prev, role]
    );
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (selected.length === 0) return;
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await apiFetch('/api/role-requests', {
        method: 'POST',
        body: JSON.stringify({ roles: selected, justification: justification || undefined }),
      });
      setSelected([]);
      setJustification('');
      setSuccess('Request submitted successfully.');
      fetchMyRequests();
      if (onRequestSent) onRequestSent();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const STATUS_COLOR = { pending: '#d97706', approved: '#16a34a', rejected: '#dc2626' };

  return (
    <div style={{ marginTop: '1.5rem' }}>
      <h2 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.75rem', color: '#111827' }}>
        Request Additional Roles
      </h2>

      {requestable.length > 0 ? (
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '0.75rem' }}>
            {requestable.map((role) => (
              <label key={role} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', fontSize: '0.9rem' }}>
                <input
                  type="checkbox"
                  checked={selected.includes(role)}
                  onChange={() => toggleRole(role)}
                />
                {role}
              </label>
            ))}
          </div>

          <textarea
            placeholder="Justification (optional)"
            value={justification}
            onChange={(e) => setJustification(e.target.value)}
            rows={3}
            style={{
              width: '100%', maxWidth: '480px', padding: '0.5rem 0.75rem',
              border: '1px solid #d1d5db', borderRadius: '0.375rem',
              fontSize: '0.9rem', resize: 'vertical', boxSizing: 'border-box',
            }}
          />

          {error && <p style={{ color: '#dc2626', fontSize: '0.85rem', marginTop: '0.5rem' }}>{error}</p>}
          {success && <p style={{ color: '#16a34a', fontSize: '0.85rem', marginTop: '0.5rem' }}>{success}</p>}

          <div style={{ marginTop: '0.75rem' }}>
            <button
              type="submit"
              disabled={submitting || selected.length === 0}
              style={{
                padding: '0.45rem 1.25rem',
                background: selected.length === 0 ? '#9ca3af' : 'var(--color-primary, #1e40af)',
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: selected.length === 0 ? 'not-allowed' : 'pointer',
              }}
            >
              {submitting ? 'Submitting…' : 'Submit Request'}
            </button>
          </div>
        </form>
      ) : (
        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>
          {available.length === 0
            ? 'You have all available roles.'
            : 'You already have pending requests for all available roles.'}
        </p>
      )}

      {myRequests.length > 0 && (
        <div style={{ marginTop: '1.5rem' }}>
          <h3 style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '0.5rem', color: '#374151' }}>
            My Role Requests
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {myRequests.map((req) => (
              <div key={req.id} style={{
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: '0.375rem', padding: '0.65rem 1rem',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem',
              }}>
                <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
                  {parseRoles(req.requested_roles).map((r) => <RoleBadge key={r} role={r} />)}
                </div>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: STATUS_COLOR[req.status] ?? '#6b7280' }}>
                  {req.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function LoginPage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Sign In</h1>
      <p>Access is managed via Cloudflare Access.</p>
      <a href="/cdn-cgi/access/login">Sign in with email</a>
    </div>
  );
}

function UnauthorizedPage() {
  return (
    <div style={{ padding: '2rem', textAlign: 'center' }}>
      <h1>Access Denied</h1>
      <p>You don't have permission to view this page.</p>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const roles = parseRoles(user?.roles);

  return (
    <div style={{ padding: '2rem', maxWidth: '640px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.75rem', fontWeight: 700, marginBottom: '0.25rem' }}>Dashboard</h1>
      <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>{user.email}</p>

      <div style={{
        background: '#f9fafb', border: '1px solid #e5e7eb',
        borderRadius: '0.5rem', padding: '1rem 1.25rem',
      }}>
        <p style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', margin: '0 0 0.5rem' }}>
          Your roles
        </p>
        {roles.length > 0 ? (
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {roles.map((r) => <RoleBadge key={r} role={r} />)}
          </div>
        ) : (
          <p style={{ color: '#6b7280', fontSize: '0.9rem', margin: 0 }}>
            No roles assigned yet — submit a request below or contact an administrator.
          </p>
        )}
      </div>

      <RoleRequestSection user={user} />
    </div>
  );
}

function AppRoutes() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/seasons"
          element={
            <ProtectedRoute>
              <SeasonsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/teams"
          element={
            <ProtectedRoute>
              <TeamsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/players"
          element={
            <ProtectedRoute>
              <PlayersPage />
            </ProtectedRoute>
          }
        />
      </Routes>
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ClubProvider>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </ClubProvider>
    </BrowserRouter>
  );
}
