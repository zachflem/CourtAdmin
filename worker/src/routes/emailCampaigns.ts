import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const emailTemplatesRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();
const emailCampaignsRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

emailTemplatesRouter.use('/*', authMiddleware);
emailCampaignsRouter.use('/*', authMiddleware);

// ─── Email Templates ───────────────────────────────────────────────────────────

// GET /api/email-templates
emailTemplatesRouter.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(`
    SELECT et.*,
           u.first_name AS creator_first_name,
           u.last_name  AS creator_last_name
    FROM email_templates et
    JOIN users u ON u.id = et.created_by
    ORDER BY et.created_at DESC
  `).all();

  return c.json(results);
});

// POST /api/email-templates
emailTemplatesRouter.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const caller = c.get('user');
  const { name, subject, content } = await c.req.json<{
    name: string;
    subject: string;
    content: string;
  }>();

  if (!name || !subject || !content) {
    return c.json({ error: 'name, subject, and content are required' }, 400);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO email_templates (id, name, subject, content, created_by) VALUES (?, ?, ?, ?, ?)`
  ).bind(id, name, subject, content, caller.id).run();

  const template = await c.env.DB.prepare(
    `SELECT * FROM email_templates WHERE id = ?`
  ).bind(id).first();

  return c.json(template, 201);
});

// PUT /api/email-templates/:id
emailTemplatesRouter.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    `SELECT id FROM email_templates WHERE id = ?`
  ).bind(id).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const { name, subject, content } = await c.req.json<{
    name: string;
    subject: string;
    content: string;
  }>();

  await c.env.DB.prepare(`
    UPDATE email_templates
    SET name = ?, subject = ?, content = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(name, subject, content, id).run();

  const updated = await c.env.DB.prepare(
    `SELECT * FROM email_templates WHERE id = ?`
  ).bind(id).first();

  return c.json(updated);
});

// DELETE /api/email-templates/:id
emailTemplatesRouter.delete('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare(
    `SELECT id FROM email_templates WHERE id = ?`
  ).bind(id).first();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  await c.env.DB.prepare(`DELETE FROM email_templates WHERE id = ?`).bind(id).run();

  return c.json({ success: true });
});

// ─── Email Campaigns ───────────────────────────────────────────────────────────

// GET /api/email-campaigns
emailCampaignsRouter.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(`
    SELECT ec.*,
           u.first_name AS sender_first_name,
           u.last_name  AS sender_last_name
    FROM email_campaigns ec
    JOIN users u ON u.id = ec.sender_id
    ORDER BY ec.created_at DESC
  `).all();

  return c.json(results);
});

// POST /api/email-campaigns — compose + send
emailCampaignsRouter.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const caller = c.get('user');
  const {
    name, subject, content, template_id,
    recipient_roles, recipient_user_ids, recipient_age_groups, recipient_team_ids,
  } = await c.req.json<{
    name: string;
    subject: string;
    content: string;
    template_id?: string;
    recipient_roles?: string[];
    recipient_user_ids?: string[];
    recipient_age_groups?: string[];
    recipient_team_ids?: string[];
  }>();

  if (!name || !subject || !content) {
    return c.json({ error: 'name, subject, and content are required' }, 400);
  }
  const hasRoles      = recipient_roles      && recipient_roles.length > 0;
  const hasUsers      = recipient_user_ids   && recipient_user_ids.length > 0;
  const hasAgeGroups  = recipient_age_groups && recipient_age_groups.length > 0;
  const hasTeams      = recipient_team_ids   && recipient_team_ids.length > 0;
  if (!hasRoles && !hasUsers && !hasAgeGroups && !hasTeams) {
    return c.json({ error: 'At least one recipient (role, age group, team, or user) must be selected' }, 400);
  }

  // Resolve recipients to a deduplicated map of user_id → email
  const recipientMap = new Map<string, string>();

  if (hasRoles) {
    const { results: allUsers } = await c.env.DB.prepare(
      `SELECT id, email, roles FROM users WHERE is_active = 1`
    ).all<{ id: string; email: string; roles: string }>();

    for (const u of allUsers) {
      let userRoles: string[] = [];
      try { userRoles = JSON.parse(u.roles || '[]'); } catch { /* skip */ }
      if (recipient_roles!.some((r) => userRoles.includes(r))) {
        recipientMap.set(u.id, u.email);
      }
    }
  }

  if (hasAgeGroups) {
    const placeholders = recipient_age_groups!.map(() => '?').join(', ');
    const { results: ageUsers } = await c.env.DB.prepare(
      `SELECT id, email FROM users WHERE age_group IN (${placeholders}) AND is_active = 1`
    ).bind(...recipient_age_groups!).all<{ id: string; email: string }>();

    for (const u of ageUsers) recipientMap.set(u.id, u.email);
  }

  if (hasTeams) {
    const placeholders = recipient_team_ids!.map(() => '?').join(', ');
    const { results: teamUsers } = await c.env.DB.prepare(
      `SELECT DISTINCT u.id, u.email
       FROM users u
       JOIN team_players tp ON tp.user_id = u.id
       WHERE tp.team_id IN (${placeholders}) AND u.is_active = 1`
    ).bind(...recipient_team_ids!).all<{ id: string; email: string }>();

    for (const u of teamUsers) recipientMap.set(u.id, u.email);
  }

  if (hasUsers) {
    for (const uid of recipient_user_ids!) {
      const u = await c.env.DB.prepare(
        `SELECT id, email FROM users WHERE id = ? AND is_active = 1`
      ).bind(uid).first<{ id: string; email: string }>();
      if (u) recipientMap.set(u.id, u.email);
    }
  }

  if (recipientMap.size === 0) {
    return c.json({ error: 'No active recipients found for the selected criteria' }, 400);
  }

  const recipientIds = [...recipientMap.keys()];
  const recipientEmails = [...recipientMap.values()];

  // Insert campaign with status 'sending'
  const id = crypto.randomUUID();
  await c.env.DB.prepare(`
    INSERT INTO email_campaigns (id, name, subject, content, recipients, sender_id, template_id, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, 'sending')
  `).bind(
    id, name, subject, content,
    JSON.stringify(recipientIds),
    caller.id,
    template_id || null,
  ).run();

  // Batch send via Resend
  const from = c.env.RESEND_FROM_EMAIL || 'email@courtadmin.seezed.net';
  let sentCount = 0;
  let failedCount = 0;

  for (const email of recipientEmails) {
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ from, to: email, subject, html: content }),
      });
      if (res.ok) {
        sentCount++;
      } else {
        failedCount++;
      }
    } catch {
      failedCount++;
    }
  }

  const finalStatus = sentCount === 0 ? 'failed' : 'sent';
  await c.env.DB.prepare(`
    UPDATE email_campaigns
    SET status = ?, sent_count = ?, failed_count = ?, updated_at = datetime('now')
    WHERE id = ?
  `).bind(finalStatus, sentCount, failedCount, id).run();

  const campaign = await c.env.DB.prepare(
    `SELECT * FROM email_campaigns WHERE id = ?`
  ).bind(id).first();

  return c.json(campaign, 201);
});

export { emailTemplatesRouter, emailCampaignsRouter };
