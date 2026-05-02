import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const ALLOWED_DOC_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'gif', 'webp']);
const DOC_CONTENT_TYPES: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};
const MAX_DOC_SIZE = 10 * 1024 * 1024;

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

// GET /api/venues — list all venues with timeslot and team counts
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee', 'coach', 'manager']);
  if (denied) return denied;

  const { results: venues } = await c.env.DB.prepare(
    `SELECT v.*,
       (SELECT COUNT(*) FROM venue_timeslots WHERE venue_id = v.id) AS timeslot_count,
       (SELECT COUNT(*) FROM venue_access WHERE venue_id = v.id) AS access_count,
       (SELECT COUNT(DISTINCT tta.team_id) FROM team_timeslot_assignments tta
        JOIN venue_timeslots vt ON vt.id = tta.timeslot_id WHERE vt.venue_id = v.id) AS team_count
     FROM venues v ORDER BY v.name`
  ).all();

  // Attach timeslots to each venue
  const venueIds = (venues as { id: string }[]).map((v) => v.id);
  if (venueIds.length === 0) return c.json([]);

  const { results: timeslots } = await c.env.DB.prepare(
    `SELECT * FROM venue_timeslots WHERE venue_id IN (${venueIds.map(() => '?').join(',')})
     ORDER BY court_name, CASE day_of_week
       WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
       WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
       WHEN 'Sunday' THEN 7 ELSE 8 END, start_time`
  ).bind(...venueIds).all();

  const timeslotIds = (timeslots as { id: string }[]).map((s) => s.id);
  const teamsBySlot = new Map<string, unknown[]>();
  if (timeslotIds.length > 0) {
    const { results: assignments } = await c.env.DB.prepare(
      `SELECT tta.timeslot_id, t.id AS team_id, t.name AS team_name
       FROM team_timeslot_assignments tta
       JOIN teams t ON t.id = tta.team_id
       WHERE tta.timeslot_id IN (${timeslotIds.map(() => '?').join(',')})`
    ).bind(...timeslotIds).all();
    for (const a of assignments as { timeslot_id: string }[]) {
      if (!teamsBySlot.has(a.timeslot_id)) teamsBySlot.set(a.timeslot_id, []);
      teamsBySlot.get(a.timeslot_id)!.push(a);
    }
  }

  const timeslotsWithTeams = (timeslots as { id: string; venue_id: string }[]).map((slot) => ({
    ...slot,
    assigned_teams: teamsBySlot.get(slot.id) ?? [],
  }));

  const slotsByVenue = new Map<string, unknown[]>();
  for (const slot of timeslotsWithTeams) {
    if (!slotsByVenue.has(slot.venue_id)) slotsByVenue.set(slot.venue_id, []);
    slotsByVenue.get(slot.venue_id)!.push(slot);
  }

  return c.json(
    (venues as { id: string }[]).map((v) => ({
      ...v,
      timeslots: slotsByVenue.get(v.id) ?? [],
    }))
  );
});

// GET /api/venues/:id — full venue detail
app.get('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee', 'coach', 'manager']);
  if (denied) return denied;

  const { id } = c.req.param();
  const venue = await c.env.DB.prepare('SELECT * FROM venues WHERE id = ?').bind(id).first();
  if (!venue) return c.json({ error: 'Venue not found' }, 404);

  const [timeslots, access, documents] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT vt.*,
         (SELECT COUNT(*) FROM team_timeslot_assignments WHERE timeslot_id = vt.id) AS team_count
       FROM venue_timeslots vt WHERE vt.venue_id = ?
       ORDER BY vt.court_name, CASE day_of_week
         WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
         WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
         WHEN 'Sunday' THEN 7 ELSE 8 END, start_time`
    ).bind(id),
    c.env.DB.prepare(
      `SELECT va.*, u.first_name, u.last_name, u.email
       FROM venue_access va JOIN users u ON u.id = va.user_id
       WHERE va.venue_id = ? ORDER BY u.last_name, u.first_name`
    ).bind(id),
    c.env.DB.prepare(
      `SELECT * FROM venue_documents WHERE venue_id = ? ORDER BY uploaded_at DESC`
    ).bind(id),
  ]);

  // For each timeslot, fetch assigned teams
  const timeslotRows = (timeslots?.results ?? []) as { id: string }[];
  let timeslotsWithTeams: unknown[] = timeslotRows;

  if (timeslotRows.length > 0) {
    const { results: assignments } = await c.env.DB.prepare(
      `SELECT tta.timeslot_id, t.id AS team_id, t.name AS team_name, t.age_group,
              s.name AS season_name
       FROM team_timeslot_assignments tta
       JOIN teams t ON t.id = tta.team_id
       LEFT JOIN seasons s ON s.id = t.season_id
       WHERE tta.timeslot_id IN (${timeslotRows.map(() => '?').join(',')})
       ORDER BY t.name`
    ).bind(...timeslotRows.map((r) => r.id)).all();

    const teamsBySlot = new Map<string, unknown[]>();
    for (const a of assignments as { timeslot_id: string }[]) {
      if (!teamsBySlot.has(a.timeslot_id)) teamsBySlot.set(a.timeslot_id, []);
      teamsBySlot.get(a.timeslot_id)!.push(a);
    }

    timeslotsWithTeams = timeslotRows.map((slot) => ({
      ...slot,
      assigned_teams: teamsBySlot.get(slot.id) ?? [],
    }));
  }

  return c.json({
    ...venue,
    timeslots: timeslotsWithTeams,
    access: access?.results ?? [],
    documents: documents?.results ?? [],
  });
});

// POST /api/venues — create venue
app.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const body = await c.req.json<{
    name: string;
    address?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    access_instructions?: string;
    cost_per_hour?: number | null;
    notes?: string;
  }>();

  if (!body.name?.trim()) return c.json({ error: 'name is required' }, 400);

  const venue = await c.env.DB.prepare(
    `INSERT INTO venues (name, address, contact_name, contact_phone, contact_email, access_instructions, cost_per_hour, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(
      body.name.trim(),
      body.address ?? '',
      body.contact_name ?? '',
      body.contact_phone ?? '',
      body.contact_email ?? '',
      body.access_instructions ?? '',
      body.cost_per_hour ?? null,
      body.notes ?? ''
    )
    .first();

  return c.json(venue, 201);
});

// PUT /api/venues/:id — update venue fields
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const existing = await c.env.DB.prepare('SELECT id FROM venues WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Venue not found' }, 404);

  const body = await c.req.json<{
    name?: string;
    address?: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
    access_instructions?: string;
    cost_per_hour?: number | null;
    notes?: string;
  }>();

  const fields: [string, unknown][] = [];
  if (body.name !== undefined) fields.push(['name', body.name.trim()]);
  if (body.address !== undefined) fields.push(['address', body.address]);
  if (body.contact_name !== undefined) fields.push(['contact_name', body.contact_name]);
  if (body.contact_phone !== undefined) fields.push(['contact_phone', body.contact_phone]);
  if (body.contact_email !== undefined) fields.push(['contact_email', body.contact_email]);
  if (body.access_instructions !== undefined) fields.push(['access_instructions', body.access_instructions]);
  if (body.cost_per_hour !== undefined) fields.push(['cost_per_hour', body.cost_per_hour ?? null]);
  if (body.notes !== undefined) fields.push(['notes', body.notes]);

  if (fields.length === 0) return c.json({ error: 'No fields to update' }, 400);

  const setClauses = fields.map(([k]) => `${k} = ?`).join(', ');
  const updated = await c.env.DB.prepare(
    `UPDATE venues SET ${setClauses}, updated_at = datetime('now') WHERE id = ? RETURNING *`
  )
    .bind(...fields.map(([, v]) => v), id)
    .first();

  return c.json(updated);
});

// DELETE /api/venues/:id — delete venue (cascades to timeslots, access, documents)
app.delete('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const existing = await c.env.DB.prepare('SELECT id FROM venues WHERE id = ?').bind(id).first();
  if (!existing) return c.json({ error: 'Venue not found' }, 404);

  // Delete R2 documents first
  const { results: docs } = await c.env.DB.prepare(
    'SELECT document_url FROM venue_documents WHERE venue_id = ?'
  ).bind(id).all() as { results: { document_url: string }[] };

  await Promise.all(
    docs.map((d) => {
      const key = d.document_url.replace(/^\/uploads\//, '');
      return c.env.UPLOADS.delete(key).catch(() => {});
    })
  );

  await c.env.DB.prepare('DELETE FROM venues WHERE id = ?').bind(id).run();
  return c.json({ success: true });
});

// POST /api/venues/:id/timeslots — add a timeslot
app.post('/:id/timeslots', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const venue = await c.env.DB.prepare('SELECT id FROM venues WHERE id = ?').bind(id).first();
  if (!venue) return c.json({ error: 'Venue not found' }, 404);

  const body = await c.req.json<{
    day_of_week: string;
    start_time: string;
    end_time: string;
    court_name?: string;
  }>();

  const VALID_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  if (!body.day_of_week || !VALID_DAYS.includes(body.day_of_week)) {
    return c.json({ error: 'day_of_week must be a valid day name' }, 400);
  }
  if (!body.start_time || !body.end_time) {
    return c.json({ error: 'start_time and end_time are required (HH:MM)' }, 400);
  }

  const slot = await c.env.DB.prepare(
    `INSERT INTO venue_timeslots (venue_id, day_of_week, start_time, end_time, court_name)
     VALUES (?, ?, ?, ?, ?) RETURNING *`
  )
    .bind(id, body.day_of_week, body.start_time, body.end_time, body.court_name?.trim() ?? '')
    .first();

  return c.json(slot, 201);
});

// DELETE /api/venues/:id/timeslots/:timeslotId — remove a timeslot
app.delete('/:id/timeslots/:timeslotId', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id, timeslotId } = c.req.param();
  const slot = await c.env.DB.prepare(
    'SELECT id FROM venue_timeslots WHERE id = ? AND venue_id = ?'
  ).bind(timeslotId, id).first();
  if (!slot) return c.json({ error: 'Timeslot not found' }, 404);

  await c.env.DB.prepare('DELETE FROM venue_timeslots WHERE id = ?').bind(timeslotId).run();
  return c.json({ success: true });
});

// POST /api/venues/:id/access — grant access to a user
app.post('/:id/access', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const venue = await c.env.DB.prepare('SELECT id FROM venues WHERE id = ?').bind(id).first();
  if (!venue) return c.json({ error: 'Venue not found' }, 404);

  const body = await c.req.json<{
    user_id: string;
    access_type?: string;
    notes?: string;
  }>();

  if (!body.user_id) return c.json({ error: 'user_id is required' }, 400);

  const user = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?').bind(body.user_id).first();
  if (!user) return c.json({ error: 'User not found' }, 404);

  const VALID_ACCESS_TYPES = ['key', 'card', 'code', 'other'];
  const accessType = body.access_type && VALID_ACCESS_TYPES.includes(body.access_type)
    ? body.access_type
    : 'key';

  const access = await c.env.DB.prepare(
    `INSERT INTO venue_access (venue_id, user_id, access_type, notes)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(venue_id, user_id) DO UPDATE SET access_type = excluded.access_type, notes = excluded.notes
     RETURNING *`
  )
    .bind(id, body.user_id, accessType, body.notes ?? '')
    .first();

  return c.json(access, 201);
});

// DELETE /api/venues/:id/access/:userId — revoke access
app.delete('/:id/access/:userId', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id, userId } = c.req.param();
  const access = await c.env.DB.prepare(
    'SELECT id FROM venue_access WHERE venue_id = ? AND user_id = ?'
  ).bind(id, userId).first();
  if (!access) return c.json({ error: 'Access record not found' }, 404);

  await c.env.DB.prepare(
    'DELETE FROM venue_access WHERE venue_id = ? AND user_id = ?'
  ).bind(id, userId).run();
  return c.json({ success: true });
});

// POST /api/venues/:id/documents — upload a document to R2
app.post('/:id/documents', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const venue = await c.env.DB.prepare('SELECT id FROM venues WHERE id = ?').bind(id).first();
  if (!venue) return c.json({ error: 'Venue not found' }, 404);

  const formData = await c.req.formData();
  const file = formData.get('file') as File | null;
  const documentName = (formData.get('document_name') as string | null) ?? '';

  if (!file) return c.json({ error: 'No file provided' }, 400);

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!ALLOWED_DOC_EXTENSIONS.has(ext)) {
    return c.json({ error: 'File type not allowed. Allowed: pdf, jpg, jpeg, png, gif, webp' }, 400);
  }
  if (file.size > MAX_DOC_SIZE) {
    return c.json({ error: 'File exceeds 10 MB limit' }, 400);
  }

  const filename = `${Date.now()}-${crypto.randomUUID().replace(/-/g, '').slice(0, 12)}.${ext}`;
  const key = `venue-docs/${id}/${filename}`;

  await c.env.UPLOADS.put(key, await file.arrayBuffer(), {
    httpMetadata: { contentType: DOC_CONTENT_TYPES[ext] ?? file.type },
  });

  const url = `/uploads/${key}`;
  const name = documentName.trim() || file.name;

  const doc = await c.env.DB.prepare(
    `INSERT INTO venue_documents (venue_id, document_name, document_url)
     VALUES (?, ?, ?) RETURNING *`
  )
    .bind(id, name, url)
    .first();

  return c.json(doc, 201);
});

// DELETE /api/venues/:id/documents/:docId — delete a document
app.delete('/:id/documents/:docId', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id, docId } = c.req.param();
  const doc = await c.env.DB.prepare(
    'SELECT * FROM venue_documents WHERE id = ? AND venue_id = ?'
  ).bind(docId, id).first<{ document_url: string }>();
  if (!doc) return c.json({ error: 'Document not found' }, 404);

  const key = doc.document_url.replace(/^\/uploads\//, '');
  await c.env.UPLOADS.delete(key).catch(() => {});
  await c.env.DB.prepare('DELETE FROM venue_documents WHERE id = ?').bind(docId).run();
  return c.json({ success: true });
});

export default app;
