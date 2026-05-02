import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';

function parseRoles(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

function canViewStaffData(caller: { id: string; roles: string | null }, targetId: string): boolean {
  const roles = parseRoles(caller.roles);
  return caller.id === targetId || roles.some((r) => ['admin', 'committee'].includes(r));
}

const TEAM_FIELDS = `
  t.id, t.name, t.age_group, t.division,
  s.id AS season_id, s.name AS season_name, s.is_active AS season_is_active,
  (SELECT COUNT(*) FROM team_players WHERE team_id = t.id) AS player_count
`;

async function attachTraining(db: D1Database, teams: { id: string }[]): Promise<unknown[]> {
  if (teams.length === 0) return teams;
  const { results: slots } = await db.prepare(
    `SELECT tta.team_id, vt.day_of_week, vt.start_time, vt.end_time, vt.court_name,
            v.name AS venue_name, v.address AS venue_address
     FROM team_timeslot_assignments tta
     JOIN venue_timeslots vt ON vt.id = tta.timeslot_id
     JOIN venues v ON v.id = vt.venue_id
     WHERE tta.team_id IN (${teams.map(() => '?').join(',')})
     ORDER BY vt.court_name, CASE vt.day_of_week
       WHEN 'Monday' THEN 1 WHEN 'Tuesday' THEN 2 WHEN 'Wednesday' THEN 3
       WHEN 'Thursday' THEN 4 WHEN 'Friday' THEN 5 WHEN 'Saturday' THEN 6
       WHEN 'Sunday' THEN 7 ELSE 8 END, vt.start_time`
  ).bind(...teams.map((t) => t.id)).all() as { results: { team_id: string }[] };

  const byTeam = new Map<string, unknown[]>();
  for (const slot of slots) {
    if (!byTeam.has(slot.team_id)) byTeam.set(slot.team_id, []);
    byTeam.get(slot.team_id)!.push(slot);
  }
  return teams.map((t) => ({ ...t, training: byTeam.get(t.id) ?? [] }));
}

// ── Coaches ───────────────────────────────────────────────────────────────────

export const coachesRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

coachesRouter.use('/*', authMiddleware);

// GET /api/coaches/:id/teams — teams where the user is listed in team_coaches
coachesRouter.get('/:id/teams', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');
  if (!canViewStaffData(caller, id)) return c.json({ error: 'Forbidden' }, 403);

  const { results: teams } = await c.env.DB.prepare(`
    SELECT ${TEAM_FIELDS}
    FROM team_coaches tc
    JOIN teams t ON tc.team_id = t.id
    JOIN seasons s ON t.season_id = s.id
    WHERE tc.user_id = ?
    ORDER BY s.is_active DESC, s.start_date DESC, t.name
  `).bind(id).all() as { results: { id: string }[] };

  return c.json(await attachTraining(c.env.DB, teams));
});

// GET /api/coaches/:id/players — unique players across all teams the coach coaches
coachesRouter.get('/:id/players', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');
  if (!canViewStaffData(caller, id)) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.jersey_number, u.age_group
    FROM team_coaches tc
    JOIN team_players tp ON tp.team_id = tc.team_id
    JOIN users u ON tp.user_id = u.id
    WHERE tc.user_id = ?
    ORDER BY u.last_name, u.first_name
  `).bind(id).all();

  return c.json(results);
});

// ── Managers ──────────────────────────────────────────────────────────────────

export const managersRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

managersRouter.use('/*', authMiddleware);

// GET /api/managers/:id/teams — teams where the user is listed in team_managers
managersRouter.get('/:id/teams', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');
  if (!canViewStaffData(caller, id)) return c.json({ error: 'Forbidden' }, 403);

  const { results: teams } = await c.env.DB.prepare(`
    SELECT ${TEAM_FIELDS}
    FROM team_managers tm
    JOIN teams t ON tm.team_id = t.id
    JOIN seasons s ON t.season_id = s.id
    WHERE tm.user_id = ?
    ORDER BY s.is_active DESC, s.start_date DESC, t.name
  `).bind(id).all() as { results: { id: string }[] };

  return c.json(await attachTraining(c.env.DB, teams));
});

// GET /api/managers/:id/players — unique players across all teams the manager manages
managersRouter.get('/:id/players', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');
  if (!canViewStaffData(caller, id)) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.jersey_number, u.age_group
    FROM team_managers tm
    JOIN team_players tp ON tp.team_id = tm.team_id
    JOIN users u ON tp.user_id = u.id
    WHERE tm.user_id = ?
    ORDER BY u.last_name, u.first_name
  `).bind(id).all();

  return c.json(results);
});

// ── Parents ───────────────────────────────────────────────────────────────────

export const parentsRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

parentsRouter.use('/*', authMiddleware);

// GET /api/parents/:id/children — player accounts linked to this parent via approved EOIs
parentsRouter.get('/:id/children', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');
  if (!canViewStaffData(caller, id)) return c.json({ error: 'Forbidden' }, 403);

  const parent = await c.env.DB.prepare(
    'SELECT email FROM users WHERE id = ?'
  ).bind(id).first<{ email: string }>();
  if (!parent) return c.json({ error: 'Not found' }, 404);

  const { results } = await c.env.DB.prepare(`
    SELECT DISTINCT u.id, u.first_name, u.last_name, u.email, u.jersey_number, u.age_group
    FROM eois e
    JOIN users u ON u.id = e.created_user_id
    WHERE e.parent_guardian_email = ? AND e.status = 'approved' AND e.created_user_id IS NOT NULL
    ORDER BY u.last_name, u.first_name
  `).bind(parent.email).all();

  return c.json(results);
});
