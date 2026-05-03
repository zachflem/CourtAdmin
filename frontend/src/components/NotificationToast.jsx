import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNotifications } from '../contexts/NotificationsContext';
import './NotificationToast.css';

const SESSION_KEY = 'notif-toast-dismissed';

function plural(n, word) {
  return `${n} ${word}${n !== 1 ? 's' : ''}`;
}

export function NotificationToast() {
  const { user } = useAuth();
  const { counts } = useNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user || counts.total === 0) return;
    if (sessionStorage.getItem(SESSION_KEY)) return;
    setVisible(true);
  }, [user, counts.total]);

  function dismiss() {
    sessionStorage.setItem(SESSION_KEY, '1');
    setVisible(false);
  }

  if (!visible) return null;

  const items = [];
  if (counts.pending_eois > 0) items.push(plural(counts.pending_eois, 'pending EOI'));
  if (counts.pending_role_requests > 0) items.push(plural(counts.pending_role_requests, 'pending role request'));
  if (counts.unread_messages > 0) items.push(plural(counts.unread_messages, 'unread message'));
  if (counts.pending_doc_acks > 0) items.push(`${plural(counts.pending_doc_acks, 'document')} to acknowledge`);

  return (
    <div className="notif-toast" role="status" aria-live="polite">
      <button className="notif-toast-close" onClick={dismiss} aria-label="Dismiss notifications">
        ×
      </button>
      <p className="notif-toast-title">
        {plural(counts.total, 'notification')} waiting
      </p>
      <ul className="notif-toast-list">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
