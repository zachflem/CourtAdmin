import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { requireRole } from '../middleware/requireRole';

const ALLOWED_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png', 'gif', 'webp']);
const CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
const MAX_SIZE = 20 * 1024 * 1024;

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

// GET /api/documents — authenticated; all roles see all club documents
app.get('/', async (c) => {
  const user = c.get('user');
  const { results } = await c.env.DB.prepare(
    `SELECT d.id, d.title, d.category, d.description, d.file_url, d.file_name,
            d.requires_acknowledgement, d.is_public, d.version,
            d.created_by, d.created_at, d.updated_at,
            CASE WHEN da.user_id IS NOT NULL THEN 1 ELSE 0 END AS user_has_acknowledged,
            da.acknowledged_at
     FROM documents d
     LEFT JOIN document_acknowledgements da ON da.document_id = d.id AND da.user_id = ?
     ORDER BY d.category, d.title`
  ).bind(user.id).all();
  return c.json(results);
});

// POST /api/documents — admin/committee; multipart upload
app.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const user = c.get('user');
  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const title = (formData.get('title') as string | null)?.trim();
  const category = ((formData.get('category') as string | null)?.trim()) || 'general';
  const description = (formData.get('description') as string | null)?.trim() || null;
  const version = ((formData.get('version') as string | null)?.trim()) || '1.0';
  const requiresAck = formData.get('requires_acknowledgement') === 'true' ? 1 : 0;
  const isPublic = formData.get('is_public') === 'true' ? 1 : 0;

  if (!file || !title) return c.json({ error: 'file and title are required' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    return c.json({ error: 'Invalid file type. Allowed: pdf, doc, docx, jpg, jpeg, png, gif, webp' }, 400);
  }
  if (file.size > MAX_SIZE) return c.json({ error: 'File exceeds 20 MB limit' }, 400);

  const docId = crypto.randomUUID().replace(/-/g, '');
  const filename = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`;
  const key = `documents/${docId}/${filename}`;

  await c.env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: CONTENT_TYPES[ext] ?? file.type },
  });

  const fileUrl = `/uploads/${key}`;

  const result = await c.env.DB.prepare(
    `INSERT INTO documents (id, title, category, description, file_url, file_name, requires_acknowledgement, is_public, version, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     RETURNING *`
  ).bind(docId, title, category, description, fileUrl, file.name, requiresAck, isPublic, version, user.id).first();

  return c.json(result, 201);
});

// PUT /api/documents/:id — update metadata + optional file replacement
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');
  const existing = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<{
    id: string; file_url: string; file_name: string;
  }>();
  if (!existing) return c.json({ error: 'Not found' }, 404);

  const contentType = c.req.header('Content-Type') ?? '';
  let title: string | undefined;
  let category: string | undefined;
  let description: string | null | undefined;
  let version: string | undefined;
  let requiresAck: number | undefined;
  let isPublic: number | undefined;
  let newFileUrl: string | undefined;
  let newFileName: string | undefined;

  if (contentType.includes('multipart/form-data')) {
    const formData = await c.req.formData();
    title = (formData.get('title') as string | null)?.trim();
    category = (formData.get('category') as string | null)?.trim();
    description = (formData.get('description') as string | null)?.trim() || null;
    version = (formData.get('version') as string | null)?.trim();
    requiresAck = formData.get('requires_acknowledgement') === 'true' ? 1 : 0;
    isPublic = formData.get('is_public') === 'true' ? 1 : 0;

    const file = formData.get('file') as File | null;
    if (file && file.size > 0) {
      const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
      if (!ALLOWED_EXTENSIONS.has(ext)) {
        return c.json({ error: 'Invalid file type' }, 400);
      }
      if (file.size > MAX_SIZE) return c.json({ error: 'File exceeds 20 MB limit' }, 400);

      // Delete old R2 object
      const oldKey = existing.file_url.replace(/^\/uploads\//, '');
      await c.env.UPLOADS.delete(oldKey).catch(() => {});

      // Upload new file
      const filename = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`;
      const key = `documents/${id}/${filename}`;
      await c.env.UPLOADS.put(key, await file.arrayBuffer(), {
        httpMetadata: { contentType: CONTENT_TYPES[ext] ?? file.type },
      });
      newFileUrl = `/uploads/${key}`;
      newFileName = file.name;
    }
  } else {
    const body = await c.req.json<{
      title?: string; category?: string; description?: string | null;
      version?: string; requires_acknowledgement?: boolean; is_public?: boolean;
    }>();
    title = body.title?.trim();
    category = body.category?.trim();
    description = body.description ?? undefined;
    version = body.version?.trim();
    requiresAck = body.requires_acknowledgement != null ? (body.requires_acknowledgement ? 1 : 0) : undefined;
    isPublic = body.is_public != null ? (body.is_public ? 1 : 0) : undefined;
  }

  const result = await c.env.DB.prepare(
    `UPDATE documents SET
       title = COALESCE(?, title),
       category = COALESCE(?, category),
       description = CASE WHEN ? IS NOT NULL THEN ? ELSE description END,
       version = COALESCE(?, version),
       requires_acknowledgement = COALESCE(?, requires_acknowledgement),
       is_public = COALESCE(?, is_public),
       file_url = COALESCE(?, file_url),
       file_name = COALESCE(?, file_name),
       updated_at = datetime('now')
     WHERE id = ?
     RETURNING *`
  ).bind(
    title ?? null,
    category ?? null,
    description !== undefined ? 'set' : null, description !== undefined ? description : null,
    version ?? null,
    requiresAck ?? null,
    isPublic ?? null,
    newFileUrl ?? null,
    newFileName ?? null,
    id
  ).first();

  return c.json(result);
});

// DELETE /api/documents/:id — remove record + R2 cleanup
app.delete('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');
  const doc = await c.env.DB.prepare('SELECT * FROM documents WHERE id = ?').bind(id).first<{
    id: string; file_url: string;
  }>();
  if (!doc) return c.json({ error: 'Not found' }, 404);

  const key = doc.file_url.replace(/^\/uploads\//, '');
  await c.env.UPLOADS.delete(key).catch(() => {});

  await c.env.DB.prepare('DELETE FROM documents WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// POST /api/documents/:id/acknowledge — any authenticated user
app.post('/:id/acknowledge', async (c) => {
  const user = c.get('user');
  const id = c.req.param('id');

  const doc = await c.env.DB.prepare('SELECT id FROM documents WHERE id = ?').bind(id).first();
  if (!doc) return c.json({ error: 'Not found' }, 404);

  const result = await c.env.DB.prepare(
    `INSERT INTO document_acknowledgements (document_id, user_id)
     VALUES (?, ?)
     ON CONFLICT(document_id, user_id) DO UPDATE SET acknowledged_at = datetime('now')
     RETURNING acknowledged_at`
  ).bind(id, user.id).first<{ acknowledged_at: string }>();

  return c.json({ acknowledged_at: result?.acknowledged_at });
});

// GET /api/documents/:id/acknowledgements — admin/committee
app.get('/:id/acknowledgements', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');
  const doc = await c.env.DB.prepare('SELECT id, title FROM documents WHERE id = ?').bind(id).first();
  if (!doc) return c.json({ error: 'Not found' }, 404);

  // Users who have acknowledged
  const { results: acknowledged } = await c.env.DB.prepare(
    `SELECT u.id, u.first_name, u.last_name, u.email, da.acknowledged_at
     FROM document_acknowledgements da
     JOIN users u ON u.id = da.user_id
     WHERE da.document_id = ?
     ORDER BY u.last_name, u.first_name`
  ).bind(id).all();

  // Users who have NOT acknowledged (active users with player/coach/manager/committee/admin roles)
  const { results: notAcknowledged } = await c.env.DB.prepare(
    `SELECT u.id, u.first_name, u.last_name, u.email
     FROM users u
     WHERE u.is_active = 1
       AND u.id NOT IN (
         SELECT user_id FROM document_acknowledgements WHERE document_id = ?
       )
     ORDER BY u.last_name, u.first_name`
  ).bind(id).all();

  return c.json({ acknowledged, not_acknowledged: notAcknowledged });
});

export default app;
