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

// ── Coaches ───────────────────────────────────────────────────────────────────

export const coachesRouter = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

coachesRouter.use('/*', authMiddleware);

// GET /api/coaches/:id/teams — teams where the user is listed in team_coaches
coachesRouter.get('/:id/teams', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');
  if (!canViewStaffData(caller, id)) return c.json({ error: 'Forbidden' }, 403);

  const { results } = await c.env.DB.prepare(`
    SELECT ${TEAM_FIELDS}
    FROM team_coaches tc
    JOIN teams t ON tc.team_id = t.id
    JOIN seasons s ON t.season_id = s.id
    WHERE tc.user_id = ?
    ORDER BY s.is_active DESC, s.start_date DESC, t.name
  `).bind(id).all();

  return c.json(results);
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

  const { results } = await c.env.DB.prepare(`
    SELECT ${TEAM_FIELDS}
    FROM team_managers tm
    JOIN teams t ON tm.team_id = t.id
    JOIN seasons s ON t.season_id = s.id
    WHERE tm.user_id = ?
    ORDER BY s.is_active DESC, s.start_date DESC, t.name
  `).bind(id).all();

  return c.json(results);
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
