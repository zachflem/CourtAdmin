import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// ── Public: submit a contact form message ─────────────────────────────────────

app.post('/api/contact', async (c) => {
  const body = await c.req.json<{
    name?: string;
    email?: string;
    enquiry_type?: string;
    message?: string;
  }>();

  const { name, email, enquiry_type, message } = body;
  if (!name?.trim() || !email?.trim() || !enquiry_type?.trim() || !message?.trim()) {
    return c.json({ error: 'name, email, enquiry_type, and message are required' }, 400);
  }

  const id = crypto.randomUUID().replace(/-/g, '');
  await c.env.DB.prepare(
    `INSERT INTO contact_messages (id, name, email, enquiry_type, message)
     VALUES (?, ?, ?, ?, ?)`
  ).bind(id, name.trim(), email.trim(), enquiry_type.trim(), message.trim()).run();

  // Resolve forwarding address
  const settings = await c.env.DB.prepare(
    'SELECT contact_email, contact_enquiry_types, club_name FROM club_settings LIMIT 1'
  ).first<{ contact_email: string | null; contact_enquiry_types: string | null; club_name: string }>();

  let forwardTo: string | null = null;
  if (settings) {
    try {
      const types: { label: string; forward_to: string }[] = JSON.parse(settings.contact_enquiry_types || '[]');
      const match = types.find((t) => t.label === enquiry_type.trim());
      forwardTo = match?.forward_to?.trim() || settings.contact_email || null;
    } catch {
      forwardTo = settings.contact_email || null;
    }
  }

  if (forwardTo && c.env.RESEND_API_KEY) {
    const from = c.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';
    const clubName = settings?.club_name || 'Your Club';
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [forwardTo],
        reply_to: email.trim(),
        subject: `[${clubName}] New ${enquiry_type.trim()} enquiry from ${name.trim()}`,
        html: `<p><strong>From:</strong> ${name.trim()} &lt;${email.trim()}&gt;</p>
<p><strong>Enquiry type:</strong> ${enquiry_type.trim()}</p>
<hr />
<p>${message.trim().replace(/\n/g, '<br />')}</p>`,
      }),
    });
  }

  return c.json({ ok: true });
});

// ── Protected: admin / committee inbox ────────────────────────────────────────

app.use('/api/contact-messages*', authMiddleware);

app.get('/api/contact-messages', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const rows = await c.env.DB.prepare(
    'SELECT * FROM contact_messages ORDER BY created_at DESC'
  ).all<Record<string, unknown>>();

  return c.json(rows.results);
});

app.put('/api/contact-messages/:id/read', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  await c.env.DB.prepare(
    `UPDATE contact_messages SET is_read = 1 WHERE id = ?`
  ).bind(c.req.param('id')).run();

  return c.json({ ok: true });
});

app.delete('/api/contact-messages/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  await c.env.DB.prepare(
    'DELETE FROM contact_messages WHERE id = ?'
  ).bind(c.req.param('id')).run();

  return c.json({ ok: true });
});

export default app;
