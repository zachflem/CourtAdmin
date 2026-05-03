import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// GET /api/notifications/summary — role-aware notification counts
app.get('/', async (c) => {
  const user = c.get('user');
  const roles: string[] = JSON.parse(user.roles || '[]');
  const isStaff = roles.includes('admin') || roles.includes('committee');

  let pending_eois = 0;
  let pending_role_requests = 0;
  let unread_messages = 0;

  if (isStaff) {
    const [eoisRow, roleReqRow, msgsRow] = await Promise.all([
      c.env.DB.prepare(`SELECT COUNT(*) AS count FROM eois WHERE status = 'pending'`).first<{ count: number }>(),
      c.env.DB.prepare(`SELECT COUNT(*) AS count FROM role_requests WHERE status = 'pending'`).first<{ count: number }>(),
      c.env.DB.prepare(`SELECT COUNT(*) AS count FROM contact_messages WHERE is_read = 0`).first<{ count: number }>(),
    ]);
    pending_eois = eoisRow?.count ?? 0;
    pending_role_requests = roleReqRow?.count ?? 0;
    unread_messages = msgsRow?.count ?? 0;
  }

  // Pending doc acks — applies to every authenticated user
  const docAckRow = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM documents
     WHERE requires_acknowledgement = 1
       AND id NOT IN (
         SELECT document_id FROM document_acknowledgements WHERE user_id = ?
       )`
  ).bind(user.id).first<{ count: number }>();
  const pending_doc_acks = docAckRow?.count ?? 0;

  const total = pending_eois + pending_role_requests + unread_messages + pending_doc_acks;

  return c.json({ pending_eois, pending_role_requests, unread_messages, pending_doc_acks, total });
});

export default app;
