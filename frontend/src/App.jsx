import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { ClubProvider } from './contexts/ClubContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { NavBar } from './components/NavBar';
import { HomePage } from './pages/HomePage';
import { TeamsPage } from './pages/TeamsPage';
import { PlayersPage } from './pages/PlayersPage';
import { DashboardPage } from './pages/DashboardPage';
import { EmailPage } from './pages/EmailPage';
import { ClubSettingsPage } from './pages/ClubSettingsPage';
import { PlatformPage } from './pages/PlatformPage';
import { VenuesPage } from './pages/VenuesPage';
import { SponsorsPage } from './pages/SponsorsPage';

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

function AppRoutes() {
  return (
    <>
      <NavBar />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/platform" element={<PlatformPage />} />
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
        <Route
          path="/email"
          element={
            <ProtectedRoute>
              <EmailPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/venues"
          element={
            <ProtectedRoute>
              <VenuesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/sponsors"
          element={
            <ProtectedRoute>
              <SponsorsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/settings"
          element={
            <ProtectedRoute roles={['admin']}>
              <ClubSettingsPage />
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
