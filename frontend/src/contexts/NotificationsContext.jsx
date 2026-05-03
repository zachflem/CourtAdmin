import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.VITE_API_URL || '';

const EMPTY = { pending_eois: 0, pending_role_requests: 0, unread_messages: 0, pending_doc_acks: 0, total: 0 };

const NotificationsContext = createContext({ counts: EMPTY, refresh: () => {} });

export function NotificationsProvider({ children }) {
  const { user } = useAuth();
  const [counts, setCounts] = useState(EMPTY);

  const refresh = useCallback(async () => {
    if (!user) { setCounts(EMPTY); return; }
    try {
      const res = await fetch(`${API_BASE}/api/notifications/summary`, { credentials: 'include' });
      if (res.ok) setCounts(await res.json());
    } catch {
      // silent — badge simply shows stale/zero counts
    }
  }, [user]);

  useEffect(() => {
    refresh();
    const id = setInterval(refresh, 60_000);
    return () => clearInterval(id);
  }, [refresh]);

  return (
    <NotificationsContext.Provider value={{ counts, refresh }}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationsContext);
}
