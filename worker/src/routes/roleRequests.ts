import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

const VALID_ROLES = ['admin', 'committee', 'coach', 'manager', 'player', 'parent'];

function parseRoles(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

// POST /api/role-requests — any authenticated user
app.post('/', async (c) => {
  const user = c.get('user');
  const body = await c.req.json<{ roles: string[]; justification?: string }>();

  if (!Array.isArray(body.roles) || body.roles.length === 0) {
    return c.json({ error: 'roles must be a non-empty array' }, 400);
  }
  if (!body.roles.every((r) => VALID_ROLES.includes(r))) {
    return c.json({ error: `roles must be from: ${VALID_ROLES.join(', ')}` }, 400);
  }

  const currentRoles = parseRoles(user.roles);
  const alreadyHeld = body.roles.filter((r) => currentRoles.includes(r));
  if (alreadyHeld.length > 0) {
    return c.json({ error: `You already have role(s): ${alreadyHeld.join(', ')}` }, 400);
  }

  // Check for any existing pending request from this user
  const existing = await c.env.DB.prepare(
    `SELECT id, requested_roles FROM role_requests WHERE user_id = ? AND status = 'pending'`
  ).bind(user.id).first<{ id: string; requested_roles: string }>();

  if (existing) {
    const pending = parseRoles(existing.requested_roles);
    const overlap = body.roles.filter((r) => pending.includes(r));
    if (overlap.length > 0) {
      return c.json({ error: `You already have a pending request for: ${overlap.join(', ')}` }, 400);
    }
  }

  await c.env.DB.prepare(`
    INSERT INTO role_requests (user_id, requested_roles, justification)
    VALUES (?, ?, ?)
  `).bind(user.id, JSON.stringify(body.roles), body.justification || null).run();

  return c.json({ ok: true }, 201);
});

// GET /api/role-requests — pending only (admin / committee)
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(`
    SELECT
      rr.id,
      rr.user_id,
      rr.requested_roles,
      rr.justification,
      rr.status,
      rr.created_at,
      u.first_name,
      u.last_name,
      u.email,
      u.roles AS current_roles
    FROM role_requests rr
    JOIN users u ON u.id = rr.user_id
    WHERE rr.status = 'pending'
    ORDER BY rr.created_at ASC
  `).all();

  return c.json(results);
});

// PUT /api/role-requests/:id — approve or reject (admin / committee)
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const processor = c.get('user');
  const body = await c.req.json<{ status: 'approved' | 'rejected'; notes?: string }>();

  if (body.status !== 'approved' && body.status !== 'rejected') {
    return c.json({ error: 'status must be approved or rejected' }, 400);
  }

  const request = await c.env.DB.prepare(
    `SELECT id, user_id, requested_roles, status FROM role_requests WHERE id = ?`
  ).bind(id).first<{ id: string; user_id: string; requested_roles: string; status: string }>();

  if (!request) return c.json({ error: 'Role request not found' }, 404);
  if (request.status !== 'pending') return c.json({ error: 'Request is no longer pending' }, 409);

  if (body.status === 'approved') {
    // Merge requested roles into the user's current roles
    const userRow = await c.env.DB.prepare('SELECT roles FROM users WHERE id = ?')
      .bind(request.user_id).first<{ roles: string }>();

    const currentRoles = parseRoles(userRow?.roles);
    const newRoles = parseRoles(request.requested_roles);
    const merged = Array.from(new Set([...currentRoles, ...newRoles]));

    await c.env.DB.batch([
      c.env.DB.prepare(
        `UPDATE users SET roles = ?, updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(merged), request.user_id),
      c.env.DB.prepare(`
        UPDATE role_requests
        SET status = 'approved', processed_by = ?, processed_at = datetime('now'), updated_at = datetime('now')
        WHERE id = ?
      `).bind(processor.id, id),
    ]);
  } else {
    await c.env.DB.prepare(`
      UPDATE role_requests
      SET status = 'rejected', processed_by = ?, processed_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?
    `).bind(processor.id, id).run();
  }

  return c.json({ ok: true });
});

// GET /api/role-requests/my — current user's own requests
app.get('/my', async (c) => {
  const user = c.get('user');

  const { results } = await c.env.DB.prepare(`
    SELECT id, requested_roles, justification, status, created_at, processed_at
    FROM role_requests
    WHERE user_id = ?
    ORDER BY created_at DESC
  `).bind(user.id).all();

  return c.json(results);
});

export default app;
