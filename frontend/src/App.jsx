import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { ClubProvider } from './contexts/ClubContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NavBar } from './components/NavBar';
import { HomePage } from './pages/HomePage';
import { SeasonsPage } from './pages/SeasonsPage';
import { TeamsPage } from './pages/TeamsPage';

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
  return (
    <div style={{ padding: '2rem' }}>
      <h1>Dashboard</h1>
      <p>Welcome, {user.email}</p>
      <p>Roles: {(user.roles ? JSON.parse(user.roles) : []).join(', ') || 'none (pending approval)'}</p>
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
