import { Hono } from 'hono';
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

const TIERS = ['gold', 'silver', 'bronze', 'general'];
const SIZES = ['small', 'medium', 'large'] as const;
type LogoSize = (typeof SIZES)[number];

const SIZE_COLUMN: Record<LogoSize, string> = {
  small: 'logo_small_url',
  medium: 'logo_medium_url',
  large: 'logo_large_url',
};

const TIER_ORDER = `CASE tier WHEN 'gold' THEN 1 WHEN 'silver' THEN 2 WHEN 'bronze' THEN 3 ELSE 4 END`;

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

// GET /api/sponsors
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(
    `SELECT * FROM sponsors ORDER BY ${TIER_ORDER}, name`
  ).all();
  return c.json(results);
});

// POST /api/sponsors
app.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const body = await c.req.json<{
    name: string;
    tier: string;
    website_url?: string;
    contact_name?: string;
    contact_email?: string;
    contact_phone?: string;
    description?: string;
    package_start?: string;
    package_end?: string;
    show_on_homepage?: boolean;
  }>();

  if (!body.name?.trim()) return c.json({ error: 'Name is required' }, 400);
  if (!TIERS.includes(body.tier)) return c.json({ error: 'Invalid tier' }, 400);

  const id = crypto.randomUUID().replace(/-/g, '').toLowerCase();
  await c.env.DB.prepare(
    `INSERT INTO sponsors (id, name, tier, website_url, contact_name, contact_email, contact_phone, description, package_start, package_end, show_on_homepage)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      id,
      body.name.trim(),
      body.tier,
      body.website_url || null,
      body.contact_name || null,
      body.contact_email || null,
      body.contact_phone || null,
      body.description || null,
      body.package_start || null,
      body.package_end || null,
      body.show_on_homepage ? 1 : 0
    )
    .run();

  const sponsor = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first();
  return c.json(sponsor, 201);
});

// GET /api/sponsors/:id
app.get('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const sponsor = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?')
    .bind(c.req.param('id'))
    .first();
  if (!sponsor) return c.json({ error: 'Sponsor not found' }, 404);
  return c.json(sponsor);
});

// PUT /api/sponsors/:id — full update (frontend always sends complete form)
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const existing = await c.env.DB.prepare('SELECT id FROM sponsors WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Sponsor not found' }, 404);

  const body = await c.req.json<{
    name: string;
    tier: string;
    website_url?: string | null;
    contact_name?: string | null;
    contact_email?: string | null;
    contact_phone?: string | null;
    description?: string | null;
    package_start?: string | null;
    package_end?: string | null;
    show_on_homepage: boolean;
    is_active: boolean;
  }>();

  if (!body.name?.trim()) return c.json({ error: 'Name is required' }, 400);
  if (!TIERS.includes(body.tier)) return c.json({ error: 'Invalid tier' }, 400);

  await c.env.DB.prepare(
    `UPDATE sponsors SET
       name = ?,
       tier = ?,
       website_url = ?,
       contact_name = ?,
       contact_email = ?,
       contact_phone = ?,
       description = ?,
       package_start = ?,
       package_end = ?,
       show_on_homepage = ?,
       is_active = ?,
       updated_at = datetime('now')
     WHERE id = ?`
  )
    .bind(
      body.name.trim(),
      body.tier,
      body.website_url || null,
      body.contact_name || null,
      body.contact_email || null,
      body.contact_phone || null,
      body.description || null,
      body.package_start || null,
      body.package_end || null,
      body.show_on_homepage ? 1 : 0,
      body.is_active !== false ? 1 : 0,
      id
    )
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?').bind(id).first();
  return c.json(updated);
});

// DELETE /api/sponsors/:id
app.delete('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const sponsor = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?')
    .bind(id)
    .first<Record<string, string | null>>();
  if (!sponsor) return c.json({ error: 'Sponsor not found' }, 404);

  for (const col of ['logo_small_url', 'logo_medium_url', 'logo_large_url']) {
    const url = sponsor[col];
    if (url) {
      const key = url.replace(/^\/uploads\//, '');
      await c.env.UPLOADS.delete(key).catch(() => {});
    }
  }

  await c.env.DB.prepare('DELETE FROM sponsors WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// POST /api/sponsors/:id/logo/:size
app.post('/:id/logo/:size', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id, size } = c.req.param();
  if (!SIZES.includes(size as LogoSize)) {
    return c.json({ error: 'Invalid size. Must be small, medium, or large' }, 400);
  }

  const sponsor = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?')
    .bind(id)
    .first<Record<string, string | null>>();
  if (!sponsor) return c.json({ error: 'Sponsor not found' }, 404);

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

  const col = SIZE_COLUMN[size as LogoSize];
  const existingUrl = sponsor[col];
  if (existingUrl) {
    const oldKey = existingUrl.replace(/^\/uploads\//, '');
    await c.env.UPLOADS.delete(oldKey).catch(() => {});
  }

  const filename = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`;
  const key = `sponsor-logos/${id}/${size}/${filename}`;

  await c.env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: CONTENT_TYPES[ext] ?? file.type },
  });

  const url = `/uploads/${key}`;
  await c.env.DB.prepare(
    `UPDATE sponsors SET ${col} = ?, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(url, id)
    .run();

  return c.json({ url });
});

// DELETE /api/sponsors/:id/logo/:size
app.delete('/:id/logo/:size', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id, size } = c.req.param();
  if (!SIZES.includes(size as LogoSize)) {
    return c.json({ error: 'Invalid size. Must be small, medium, or large' }, 400);
  }

  const sponsor = await c.env.DB.prepare('SELECT * FROM sponsors WHERE id = ?')
    .bind(id)
    .first<Record<string, string | null>>();
  if (!sponsor) return c.json({ error: 'Sponsor not found' }, 404);

  const col = SIZE_COLUMN[size as LogoSize];
  const existingUrl = sponsor[col];
  if (existingUrl) {
    const oldKey = existingUrl.replace(/^\/uploads\//, '');
    await c.env.UPLOADS.delete(oldKey).catch(() => {});
  }

  await c.env.DB.prepare(
    `UPDATE sponsors SET ${col} = NULL, updated_at = datetime('now') WHERE id = ?`
  )
    .bind(id)
    .run();

  return c.json({ success: true });
});

export default app;
