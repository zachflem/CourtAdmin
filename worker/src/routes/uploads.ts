import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const ALLOWED_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp']);
const CONTENT_TYPES: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
const MAX_SIZE = 10 * 1024 * 1024;

const SLOT_COLUMN = {
  logo: 'logo_url',
  'hero-image': 'hero_image_url',
  'about-image': 'about_image_url',
} as const;

type Slot = keyof typeof SLOT_COLUMN;
type AppContext = Context<{ Bindings: Env; Variables: HonoVariables }>;

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('*', authMiddleware);

async function ensureSettingsRow(db: D1Database) {
  const row = await db.prepare('SELECT id FROM club_settings LIMIT 1').first<{ id: string }>();
  if (!row) {
    await db
      .prepare(
        `INSERT INTO club_settings (club_name, mission_statement, about_text, primary_color, secondary_color, accent_color)
         VALUES ('Our Club', 'Excellence in sport, community, and development.',
                 'Founded with a passion for sport and community development.',
                 '#1e40af', '#3b82f6', '#f59e0b')`
      )
      .run();
  }
}

async function handleUpload(c: AppContext, slot: Slot) {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  if (!file) return c.json({ error: 'No file provided' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json({ error: 'File type not allowed. Allowed: jpg, jpeg, png, gif, webp' }, 400);
  }
  if (file.size > MAX_SIZE) {
    return c.json({ error: 'File exceeds 10 MB limit' }, 400);
  }

  const col = SLOT_COLUMN[slot];

  // Delete previous object from R2 before replacing
  const existing = await c.env.DB.prepare(
    `SELECT ${col} AS current_url FROM club_settings LIMIT 1`
  ).first<{ current_url: string | null }>();

  if (existing?.current_url) {
    const oldKey = existing.current_url.replace(/^\/uploads\//, '');
    await c.env.UPLOADS.delete(oldKey).catch(() => {});
  }

  const filename = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`;
  const key = `${slot}/${filename}`;

  await c.env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: CONTENT_TYPES[ext] ?? file.type },
  });

  const url = `/uploads/${key}`;

  await ensureSettingsRow(c.env.DB);
  await c.env.DB.prepare(
    `UPDATE club_settings SET ${col} = ?, updated_at = datetime('now')
     WHERE id = (SELECT id FROM club_settings LIMIT 1)`
  )
    .bind(url)
    .run();

  return c.json({ url });
}

async function handleDelete(c: AppContext, slot: Slot) {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const col = SLOT_COLUMN[slot];

  const existing = await c.env.DB.prepare(
    `SELECT ${col} AS current_url FROM club_settings LIMIT 1`
  ).first<{ current_url: string | null }>();

  if (existing?.current_url) {
    const key = existing.current_url.replace(/^\/uploads\//, '');
    await c.env.UPLOADS.delete(key).catch(() => {});
  }

  await c.env.DB.prepare(
    `UPDATE club_settings SET ${col} = NULL, updated_at = datetime('now')
     WHERE id = (SELECT id FROM club_settings LIMIT 1)`
  ).run();

  return c.json({ success: true });
}

app.post('/upload-logo', (c) => handleUpload(c, 'logo'));
app.delete('/delete-logo', (c) => handleDelete(c, 'logo'));
app.post('/upload-hero-image', (c) => handleUpload(c, 'hero-image'));
app.delete('/delete-hero-image', (c) => handleDelete(c, 'hero-image'));
app.post('/upload-about-image', (c) => handleUpload(c, 'about-image'));
app.delete('/delete-about-image', (c) => handleDelete(c, 'about-image'));

export default app;
