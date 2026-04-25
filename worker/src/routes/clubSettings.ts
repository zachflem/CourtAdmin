import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const ALLOWED_FIELDS = [
  'club_name',
  'mission_statement',
  'about_text',
  'contact_phone',
  'contact_email',
  'contact_address',
  'primary_color',
  'secondary_color',
  'accent_color',
] as const;

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM club_settings LIMIT 1').first();
  if (!row) {
    return c.json({
      club_name: 'Our Club',
      mission_statement: 'Excellence in sport, community, and development.',
      about_text: 'Founded with a passion for sport and community development.',
      contact_phone: null,
      contact_email: null,
      contact_address: null,
      primary_color: '#1e40af',
      secondary_color: '#3b82f6',
      accent_color: '#f59e0b',
      logo_url: null,
      hero_image_url: null,
      about_image_url: null,
    });
  }
  return c.json(row);
});

app.put('/', authMiddleware, async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const body = await c.req.json<Record<string, string>>();

  const entries = Object.entries(body).filter(([k]) =>
    (ALLOWED_FIELDS as readonly string[]).includes(k)
  );

  if (entries.length === 0) {
    return c.json({ error: 'No valid fields provided' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM club_settings LIMIT 1'
  ).first<{ id: string }>();

  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO club_settings (club_name, mission_statement, about_text, primary_color, secondary_color, accent_color)
       VALUES ('Our Club', 'Excellence in sport, community, and development.',
               'Founded with a passion for sport and community development.',
               '#1e40af', '#3b82f6', '#f59e0b')`
    ).run();
  }

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  await c.env.DB.prepare(
    `UPDATE club_settings SET ${setClauses}, updated_at = datetime('now')
     WHERE id = (SELECT id FROM club_settings LIMIT 1)`
  )
    .bind(...values)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM club_settings LIMIT 1').first();
  return c.json(updated);
});

export default app;
