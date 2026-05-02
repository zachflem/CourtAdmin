import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

// GET /api/club-positions — list all (admin/committee)
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(
    `SELECT id, name, display_order, created_at FROM club_positions ORDER BY display_order, name`
  ).all();

  return c.json(results);
});

// POST /api/club-positions — create (admin)
app.post('/', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const body = await c.req.json<{ name: string }>();
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400);

  const existing = await c.env.DB.prepare(
    'SELECT id FROM club_positions WHERE name = ?'
  ).bind(body.name.trim()).first();
  if (existing) return c.json({ error: 'Position already exists' }, 409);

  const countRow = await c.env.DB.prepare(
    'SELECT COALESCE(MAX(display_order), -1) as max_order FROM club_positions'
  ).first<{ max_order: number }>();
  const nextOrder = (countRow?.max_order ?? -1) + 1;

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO club_positions (id, name, display_order) VALUES (?, ?, ?)`
  ).bind(id, body.name.trim(), nextOrder).run();

  const position = await c.env.DB.prepare(
    `SELECT id, name, display_order, created_at FROM club_positions WHERE id = ?`
  ).bind(id).first();

  return c.json(position, 201);
});

// PUT /api/club-positions/:id — rename (admin)
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const { id } = c.req.param();
  const body = await c.req.json<{ name: string }>();
  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400);

  const existing = await c.env.DB.prepare('SELECT id FROM club_positions WHERE id = ?')
    .bind(id).first();
  if (!existing) return c.json({ error: 'Position not found' }, 404);

  await c.env.DB.prepare(
    `UPDATE club_positions SET name = ? WHERE id = ?`
  ).bind(body.name.trim(), id).run();

  const updated = await c.env.DB.prepare(
    `SELECT id, name, display_order, created_at FROM club_positions WHERE id = ?`
  ).bind(id).first();

  return c.json(updated);
});

// DELETE /api/club-positions/:id — delete, cascades user_positions (admin)
app.delete('/:id', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const { id } = c.req.param();
  const existing = await c.env.DB.prepare('SELECT id FROM club_positions WHERE id = ?')
    .bind(id).first();
  if (!existing) return c.json({ error: 'Position not found' }, 404);

  await c.env.DB.prepare('DELETE FROM club_positions WHERE id = ?').bind(id).run();

  return c.json({ deleted: true });
});

export default app;
