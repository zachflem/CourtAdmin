import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];

const PLAYER_SELECT = `
  id, email, first_name, last_name, phone, address, emergency_contact,
  medical_info, gender, date_of_birth, grading_level, age_group,
  jersey_number, clearance_required, clearance_status,
  previous_club_name, previous_team_name, previous_coach_name,
  first_year_registered, is_active, roles, created_at, updated_at
`;

function parseRoles(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

app.use('/*', authMiddleware);

// GET /api/players/available-jersey-numbers/:age_group
// Returns jersey numbers 1–99 not already taken in the given age group or adjacent ones.
app.get('/available-jersey-numbers/:age_group', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const ageGroup = c.req.param('age_group');
  const i = AGE_GROUPS.indexOf(ageGroup);
  if (i === -1) return c.json({ error: 'Invalid age group' }, 400);

  const nearby = [i - 1, i, i + 1]
    .filter((n) => n >= 0 && n < AGE_GROUPS.length)
    .map((n) => AGE_GROUPS[n]);

  const placeholders = nearby.map(() => '?').join(', ');
  const { results } = await c.env.DB.prepare(
    `SELECT jersey_number FROM users
     WHERE jersey_number IS NOT NULL AND age_group IN (${placeholders}) AND is_active = 1`
  ).bind(...nearby).all<{ jersey_number: number }>();

  const taken = new Set(results.map((r) => r.jersey_number));
  const available: number[] = [];
  for (let n = 1; n <= 99; n++) {
    if (!taken.has(n)) available.push(n);
  }

  return c.json({ available, taken: [...taken].sort((a, b) => a - b) });
});

// GET /api/players/:id — player profile
// Players see own only; coaches/managers/committee/admin see any.
app.get('/:id', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');

  const isPrivileged = parseRoles(caller.roles).some((r) =>
    ['admin', 'committee', 'coach', 'manager'].includes(r)
  );
  if (!isPrivileged && caller.id !== id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const player = await c.env.DB.prepare(
    `SELECT ${PLAYER_SELECT} FROM users WHERE id = ?`
  ).bind(id).first();

  if (!player) return c.json({ error: 'Not found' }, 404);
  return c.json(player);
});

// PUT /api/players/:id — update own profile (limited to contact/personal fields)
app.put('/:id', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');

  const isPrivileged = parseRoles(caller.roles).some((r) =>
    ['admin', 'committee'].includes(r)
  );
  if (!isPrivileged && caller.id !== id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const body = await c.req.json<{
    phone?: string | null;
    address?: string | null;
    emergency_contact?: string | null;
    medical_info?: string | null;
  }>();

  const now = new Date().toISOString();
  await c.env.DB.prepare(`
    UPDATE users
    SET phone = ?, address = ?, emergency_contact = ?, medical_info = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    body.phone ?? null,
    body.address ?? null,
    body.emergency_contact ?? null,
    body.medical_info ?? null,
    now,
    id
  ).run();

  const updated = await c.env.DB.prepare(
    `SELECT ${PLAYER_SELECT} FROM users WHERE id = ?`
  ).bind(id).first();

  return c.json(updated);
});

// GET /api/players/:id/teams — teams the player is a member of
app.get('/:id/teams', async (c) => {
  const caller = c.get('user');
  const id = c.req.param('id');

  const isPrivileged = parseRoles(caller.roles).some((r) =>
    ['admin', 'committee', 'coach', 'manager'].includes(r)
  );
  if (!isPrivileged && caller.id !== id) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT t.id, t.name, t.age_group,
           s.id AS season_id, s.name AS season_name, s.is_active AS season_is_active
    FROM team_players tp
    JOIN teams t ON tp.team_id = t.id
    JOIN seasons s ON t.season_id = s.id
    WHERE tp.player_id = ?
    ORDER BY s.is_active DESC, s.start_date DESC, t.name
  `).bind(id).all();

  return c.json(results);
});

export default app;
