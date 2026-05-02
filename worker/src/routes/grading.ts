import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

function parseRoles(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

function uuid(): string {
  return crypto.randomUUID();
}

// GET /api/grading-sessions
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(`
    SELECT gs.*,
           s.name AS season_name,
           u.first_name AS conducted_by_first_name,
           u.last_name  AS conducted_by_last_name,
           (SELECT COUNT(*) FROM grading_session_players gsp WHERE gsp.session_id = gs.id) AS player_count
    FROM grading_sessions gs
    JOIN seasons s ON s.id = gs.season_id
    LEFT JOIN users u ON u.id = gs.conducted_by
    ORDER BY gs.created_at DESC
  `).all();

  return c.json(results);
});

// POST /api/grading-sessions — create + auto-populate players
app.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const caller = c.get('user');
  const body = await c.req.json<{
    name: string;
    season_id: string;
    age_group: string;
    gender: string;
    notes?: string;
    conducted_by?: string;
    conducted_at?: string;
  }>();

  if (!body.name?.trim() || !body.season_id || !body.age_group || !body.gender) {
    return c.json({ error: 'name, season_id, age_group, and gender are required' }, 400);
  }

  const validGenders = ['Male', 'Female', 'Mixed'];
  if (!validGenders.includes(body.gender)) {
    return c.json({ error: 'gender must be Male, Female, or Mixed' }, 400);
  }

  const seasonExists = await c.env.DB.prepare(
    `SELECT id FROM seasons WHERE id = ?`
  ).bind(body.season_id).first();
  if (!seasonExists) return c.json({ error: 'Season not found' }, 404);

  const now = new Date().toISOString();
  const sessionId = uuid();

  await c.env.DB.prepare(`
    INSERT INTO grading_sessions
      (id, season_id, name, age_group, gender, status, notes, conducted_by, conducted_at, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId, body.season_id, body.name.trim(), body.age_group, body.gender,
    body.notes ?? null, body.conducted_by ?? null, body.conducted_at ?? null,
    caller.id, now, now
  ).run();

  // Auto-populate players
  let playersQuery = `
    SELECT u.id, u.first_name, u.last_name, u.date_of_birth, u.age_group, u.gender, u.grading_level
    FROM users u
    WHERE u.is_active = 1
      AND u.roles LIKE '%"player"%'
      AND u.age_group = ?
  `;
  const binds: unknown[] = [body.age_group];

  if (body.gender !== 'Mixed') {
    playersQuery += ` AND u.gender = ?`;
    binds.push(body.gender);
  }

  const { results: players } = await c.env.DB.prepare(playersQuery)
    .bind(...binds)
    .all<{
      id: string;
      first_name: string;
      last_name: string;
      date_of_birth: string | null;
      age_group: string | null;
      gender: string | null;
      grading_level: number | null;
    }>();

  // Fetch previous teams per player
  const insertStmts = await Promise.all(players.map(async (p) => {
    const { results: teams } = await c.env.DB.prepare(`
      SELECT t.name
      FROM team_players tp
      JOIN teams t ON t.id = tp.team_id
      WHERE tp.user_id = ?
      ORDER BY t.name
    `).bind(p.id).all<{ name: string }>();

    const prevTeams = JSON.stringify(teams.map((t) => t.name));

    return c.env.DB.prepare(`
      INSERT INTO grading_session_players
        (id, session_id, user_id, snapshot_name, snapshot_dob, snapshot_age_group,
         snapshot_gender, snapshot_grading_level, snapshot_previous_teams)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      uuid(), sessionId, p.id,
      `${p.first_name} ${p.last_name}`,
      p.date_of_birth ?? null,
      p.age_group ?? null,
      p.gender ?? null,
      p.grading_level ?? null,
      prevTeams
    );
  }));

  if (insertStmts.length > 0) {
    await c.env.DB.batch(insertStmts);
  }

  const session = await c.env.DB.prepare(
    `SELECT * FROM grading_sessions WHERE id = ?`
  ).bind(sessionId).first();

  return c.json({ ...session, player_count: players.length }, 201);
});

// GET /api/grading-sessions/:id
app.get('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');

  const session = await c.env.DB.prepare(`
    SELECT gs.*,
           s.name AS season_name,
           u.first_name AS conducted_by_first_name,
           u.last_name  AS conducted_by_last_name
    FROM grading_sessions gs
    JOIN seasons s ON s.id = gs.season_id
    LEFT JOIN users u ON u.id = gs.conducted_by
    WHERE gs.id = ?
  `).bind(id).first();

  if (!session) return c.json({ error: 'Not found' }, 404);

  const { results: players } = await c.env.DB.prepare(`
    SELECT gsp.*,
           eu.first_name AS entered_by_first_name,
           eu.last_name  AS entered_by_last_name
    FROM grading_session_players gsp
    LEFT JOIN users eu ON eu.id = gsp.entered_by
    WHERE gsp.session_id = ?
    ORDER BY gsp.snapshot_name ASC
  `).bind(id).all();

  return c.json({ ...session, players });
});

// PUT /api/grading-sessions/:id — update metadata
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');
  const session = await c.env.DB.prepare(
    `SELECT id, status FROM grading_sessions WHERE id = ?`
  ).bind(id).first<{ id: string; status: string }>();

  if (!session) return c.json({ error: 'Not found' }, 404);
  if (session.status === 'committed') return c.json({ error: 'Cannot edit a committed session' }, 400);

  const body = await c.req.json<{
    name?: string;
    notes?: string | null;
    conducted_by?: string | null;
    conducted_at?: string | null;
  }>();

  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    UPDATE grading_sessions
    SET name = COALESCE(?, name),
        notes = ?,
        conducted_by = ?,
        conducted_at = ?,
        updated_at = ?
    WHERE id = ?
  `).bind(
    body.name?.trim() ?? null,
    body.notes ?? null,
    body.conducted_by ?? null,
    body.conducted_at ?? null,
    now, id
  ).run();

  const updated = await c.env.DB.prepare(
    `SELECT * FROM grading_sessions WHERE id = ?`
  ).bind(id).first();

  return c.json(updated);
});

// DELETE /api/grading-sessions/:id — draft only
app.delete('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');
  const session = await c.env.DB.prepare(
    `SELECT id, status FROM grading_sessions WHERE id = ?`
  ).bind(id).first<{ id: string; status: string }>();

  if (!session) return c.json({ error: 'Not found' }, 404);
  if (session.status === 'committed') return c.json({ error: 'Cannot delete a committed session' }, 400);

  await c.env.DB.prepare(
    `DELETE FROM grading_sessions WHERE id = ?`
  ).bind(id).run();

  return c.json({ ok: true });
});

// PUT /api/grading-sessions/:id/players — bulk upsert grading results
app.put('/:id/players', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const caller = c.get('user');
  const id = c.req.param('id');

  const session = await c.env.DB.prepare(
    `SELECT id, status FROM grading_sessions WHERE id = ?`
  ).bind(id).first<{ id: string; status: string }>();

  if (!session) return c.json({ error: 'Not found' }, 404);
  if (session.status === 'committed') return c.json({ error: 'Cannot edit a committed session' }, 400);

  const body = await c.req.json<Array<{
    id: string;
    new_grading_level?: number | null;
    division_recommendation?: string | null;
    coach_notes?: string | null;
  }>>();

  if (!Array.isArray(body) || body.length === 0) {
    return c.json({ error: 'Expected an array of player updates' }, 400);
  }

  const now = new Date().toISOString();

  const stmts = body.map((row) =>
    c.env.DB.prepare(`
      UPDATE grading_session_players
      SET new_grading_level = ?,
          division_recommendation = ?,
          coach_notes = ?,
          entered_by = ?,
          entered_at = ?
      WHERE id = ? AND session_id = ?
    `).bind(
      row.new_grading_level ?? null,
      row.division_recommendation ?? null,
      row.coach_notes ?? null,
      caller.id,
      now,
      row.id,
      id
    )
  );

  await c.env.DB.batch(stmts);

  const { results: players } = await c.env.DB.prepare(
    `SELECT * FROM grading_session_players WHERE session_id = ? ORDER BY snapshot_name ASC`
  ).bind(id).all();

  return c.json(players);
});

// POST /api/grading-sessions/:id/commit
app.post('/:id/commit', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');

  const session = await c.env.DB.prepare(
    `SELECT * FROM grading_sessions WHERE id = ?`
  ).bind(id).first<{
    id: string; status: string; name: string; conducted_by: string | null;
  }>();

  if (!session) return c.json({ error: 'Not found' }, 404);
  if (session.status === 'committed') return c.json({ error: 'Session already committed' }, 400);

  const { results: players } = await c.env.DB.prepare(`
    SELECT * FROM grading_session_players
    WHERE session_id = ? AND new_grading_level IS NOT NULL
  `).bind(id).all<{
    id: string;
    user_id: string;
    new_grading_level: number;
    division_recommendation: string | null;
    coach_notes: string | null;
  }>();

  const caller = c.get('user');
  const coachId = session.conducted_by ?? caller.id;
  const now = new Date().toISOString();

  const stmts: ReturnType<typeof c.env.DB.prepare>[] = [];

  for (const p of players) {
    // Update player profile
    stmts.push(
      c.env.DB.prepare(
        `UPDATE users SET grading_level = ?, updated_at = ? WHERE id = ?`
      ).bind(p.new_grading_level, now, p.user_id)
    );

    // Create grading feedback record
    const divNote = p.division_recommendation ? ` — ${p.division_recommendation}` : '';
    stmts.push(
      c.env.DB.prepare(`
        INSERT INTO player_feedback
          (id, player_id, coach_id, title, content, feedback_type, feedback_context, rating, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 'general', 'grading', ?, ?, ?)
      `).bind(
        uuid(),
        p.user_id,
        coachId,
        `Grading — ${session.name}${divNote}`,
        p.coach_notes ?? '',
        p.new_grading_level,
        now, now
      )
    );
  }

  // Mark session committed
  stmts.push(
    c.env.DB.prepare(
      `UPDATE grading_sessions SET status = 'committed', updated_at = ? WHERE id = ?`
    ).bind(now, id)
  );

  await c.env.DB.batch(stmts);

  return c.json({ ok: true, players_updated: players.length });
});

// GET /api/grading-sessions/:id/print — printable HTML roster
app.get('/:id/print', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const id = c.req.param('id');

  const session = await c.env.DB.prepare(`
    SELECT gs.*, s.name AS season_name
    FROM grading_sessions gs
    JOIN seasons s ON s.id = gs.season_id
    WHERE gs.id = ?
  `).bind(id).first<{
    id: string; name: string; age_group: string; gender: string;
    season_name: string; conducted_at: string | null; status: string;
  }>();

  if (!session) return c.json({ error: 'Not found' }, 404);

  const { results: players } = await c.env.DB.prepare(`
    SELECT * FROM grading_session_players
    WHERE session_id = ?
    ORDER BY snapshot_name ASC
  `).bind(id).all<{
    snapshot_name: string;
    snapshot_dob: string | null;
    snapshot_age_group: string | null;
    snapshot_grading_level: number | null;
    snapshot_previous_teams: string | null;
    new_grading_level: number | null;
    division_recommendation: string | null;
    coach_notes: string | null;
  }>();

  const settings = await c.env.DB.prepare(
    `SELECT club_name FROM club_settings LIMIT 1`
  ).first<{ club_name: string }>();

  const clubName = settings?.club_name ?? 'CourtAdmin';

  const sessionDate = session.conducted_at
    ? new Date(session.conducted_at).toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  const rows = players.map((p, i) => {
    let prevTeams = '';
    try { prevTeams = (JSON.parse(p.snapshot_previous_teams ?? '[]') as string[]).join(', '); } catch { /* */ }

    const dobFormatted = p.snapshot_dob
      ? new Date(p.snapshot_dob).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
      : '';

    return `<tr>
      <td class="num">${i + 1}</td>
      <td class="name">${p.snapshot_name}</td>
      <td>${dobFormatted}</td>
      <td>${prevTeams}</td>
      <td class="grade-prev">${p.snapshot_grading_level ?? ''}</td>
      <td class="grade-box"></td>
      <td class="grade-box"></td>
      <td class="notes-col"></td>
    </tr>`;
  }).join('\n');

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${session.name} — Grading Roster</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: Arial, sans-serif; font-size: 11px; color: #000; background: #fff; }
  .header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 12px; padding-bottom: 8px; border-bottom: 2px solid #000; }
  .header-left h1 { font-size: 16px; font-weight: bold; }
  .header-left h2 { font-size: 13px; font-weight: normal; margin-top: 2px; }
  .header-meta { font-size: 10px; color: #555; margin-top: 4px; }
  .print-btn { padding: 6px 14px; background: #3b82f6; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-size: 12px; }
  @media print { .print-btn { display: none; } }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; }
  th { background: #222; color: #fff; padding: 5px 4px; text-align: left; font-size: 10px; font-weight: bold; }
  td { padding: 5px 4px; border-bottom: 1px solid #ccc; vertical-align: top; }
  tr:nth-child(even) td { background: #f9f9f9; }
  .num { width: 28px; text-align: center; }
  .name { width: 140px; font-weight: bold; }
  .grade-prev { width: 56px; text-align: center; font-weight: bold; color: #555; }
  .grade-box { width: 60px; border-bottom: none !important; }
  .grade-box td { border: 1.5px solid #999; height: 28px; }
  .notes-col { width: auto; min-height: 28px; border-bottom: none !important; }
  .grade-box-cell { border: 1.5px solid #888 !important; height: 28px; min-width: 52px; }
  .notes-cell { border-bottom: 1px dotted #aaa !important; height: 28px; }
  @page { size: A4 landscape; margin: 12mm; }
  @media print { body { font-size: 10px; } .header { margin-bottom: 8px; } }
</style>
</head>
<body>
<div class="header">
  <div class="header-left">
    <div style="font-weight:bold;font-size:14px;">${clubName}</div>
    <h1>${session.name}</h1>
    <h2>${session.age_group} &middot; ${session.gender}${sessionDate ? ' &middot; ' + sessionDate : ''} &middot; ${session.season_name}</h2>
    <div class="header-meta">${players.length} players listed</div>
  </div>
  <button class="print-btn" onclick="window.print()">Print this page</button>
</div>
<table>
  <thead>
    <tr>
      <th class="num">#</th>
      <th>Name</th>
      <th style="width:90px">DOB</th>
      <th>Previous Teams</th>
      <th style="width:56px;text-align:center">Prev Grade</th>
      <th style="width:62px;text-align:center">New Grade</th>
      <th style="width:90px;text-align:center">Division</th>
      <th>Notes</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
  </tbody>
</table>
<div style="margin-top:16px;font-size:9px;color:#aaa;text-align:right;">Generated by CourtAdmin &middot; ${new Date().toLocaleDateString('en-AU')}</div>
</body>
</html>`;

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=UTF-8' },
  });
});

export default app;
