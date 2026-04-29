import { createContext, useContext, useEffect, useState } from 'react';

const AuthContext = createContext(null);

const API_BASE = import.meta.env.VITE_API_URL || '';
const MOCK_ROLE_KEY = 'courtadmin_mock_role';

export function AuthProvider({ children }) {
  const [realUser, setRealUser] = useState(undefined); // undefined = loading, null = unauthenticated
  const [error, setError] = useState(null);
  const [mockRole, setMockRoleState] = useState(() => localStorage.getItem(MOCK_ROLE_KEY));

  useEffect(() => {
    fetch(`${API_BASE}/api/auth/me`, { credentials: 'include' })
      .then((res) => {
        if (res.status === 401) {
          setRealUser(null);
          return null;
        }
        if (!res.ok) throw new Error('Failed to load user');
        return res.json();
      })
      .then((data) => {
        if (data) {
          // If real user is not an admin, clear any stored mock role
          const roles = JSON.parse(data.roles || '[]');
          if (!roles.includes('admin')) {
            localStorage.removeItem(MOCK_ROLE_KEY);
            setMockRoleState(null);
          }
          setRealUser(data);
        }
      })
      .catch((err) => {
        setError(err.message);
        setRealUser(null);
      });
  }, []);

  const setMockRole = (role) => {
    if (role) {
      localStorage.setItem(MOCK_ROLE_KEY, role);
    } else {
      localStorage.removeItem(MOCK_ROLE_KEY);
    }
    setMockRoleState(role || null);
  };

  const isMocking = !!mockRole && !!realUser;
  const user = isMocking
    ? { ...realUser, roles: JSON.stringify([mockRole]) }
    : realUser;

  return (
    <AuthContext.Provider value={{ user, realUser, mockRole, setMockRole, isMocking, error, loading: realUser === undefined }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
