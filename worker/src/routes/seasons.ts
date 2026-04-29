import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// Public — open + active seasons for EOI dropdown
// If eoi_start_date/eoi_end_date are set, only return the season when today falls within that window.
app.get('/available', async (c) => {
  const { results } = await c.env.DB.prepare(
    `SELECT id, name, start_date, end_date, age_cutoff_date, eoi_start_date, eoi_end_date
     FROM seasons
     WHERE is_active = 1
       AND is_closed = 0
       AND (
         eoi_start_date IS NULL
         OR (date('now') >= eoi_start_date AND date('now') <= eoi_end_date)
       )
     ORDER BY start_date DESC`
  ).all();
  return c.json(results);
});

// All remaining endpoints require auth + committee/admin
app.use('/*', authMiddleware);

app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM seasons ORDER BY start_date DESC`
  ).all();
  return c.json(results);
});

app.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const body = await c.req.json<{
    name: string;
    start_date: string;
    end_date: string;
    age_cutoff_date?: string;
    eoi_start_date?: string;
    eoi_end_date?: string;
  }>();

  const { name, start_date, end_date } = body;
  if (!name || !start_date || !end_date) {
    return c.json({ error: 'name, start_date, and end_date are required' }, 400);
  }

  // Default age_cutoff_date to Jan 1 of the season's start year
  const age_cutoff_date =
    body.age_cutoff_date || `${new Date(start_date).getUTCFullYear()}-01-01`;

  const eoi_start_date = body.eoi_start_date || null;
  const eoi_end_date = body.eoi_end_date || null;

  const result = await c.env.DB.prepare(
    `INSERT INTO seasons (name, start_date, end_date, age_cutoff_date, eoi_start_date, eoi_end_date)
     VALUES (?, ?, ?, ?, ?, ?)
     RETURNING *`
  )
    .bind(name, start_date, end_date, age_cutoff_date, eoi_start_date, eoi_end_date)
    .first();

  return c.json(result, 201);
});

app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();

  const existing = await c.env.DB.prepare(
    'SELECT * FROM seasons WHERE id = ?'
  )
    .bind(id)
    .first();
  if (!existing) return c.json({ error: 'Season not found' }, 404);

  const body = await c.req.json<{
    name?: string;
    start_date?: string;
    end_date?: string;
    age_cutoff_date?: string;
    eoi_start_date?: string | null;
    eoi_end_date?: string | null;
    is_active?: boolean;
    is_closed?: boolean;
  }>();

  const ALLOWED = ['name', 'start_date', 'end_date', 'age_cutoff_date', 'eoi_start_date', 'eoi_end_date', 'is_active', 'is_closed'] as const;
  type AllowedKey = typeof ALLOWED[number];

  const entries = (Object.entries(body) as [AllowedKey, unknown][]).filter(
    ([k]) => (ALLOWED as readonly string[]).includes(k)
  );

  if (entries.length === 0) {
    return c.json({ error: 'No valid fields provided' }, 400);
  }

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => {
    // Coerce booleans to SQLite integers
    if (typeof v === 'boolean') return v ? 1 : 0;
    return v;
  });

  const updated = await c.env.DB.prepare(
    `UPDATE seasons SET ${setClauses}, updated_at = datetime('now')
     WHERE id = ?
     RETURNING *`
  )
    .bind(...values, id)
    .first();

  return c.json(updated);
});

export default app;
