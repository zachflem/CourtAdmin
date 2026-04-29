import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const DEFAULT_AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];

async function getAgeGroups(db: D1Database): Promise<string[]> {
  const row = await db.prepare(
    `SELECT age_groups FROM club_settings LIMIT 1`
  ).first<{ age_groups: string }>();
  if (!row) return DEFAULT_AGE_GROUPS;
  try { return JSON.parse(row.age_groups); } catch { return DEFAULT_AGE_GROUPS; }
}

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
  const ageGroups = await getAgeGroups(c.env.DB);
  const i = ageGroups.indexOf(ageGroup);
  if (i === -1) return c.json({ error: 'Invalid age group' }, 400);

  const nearby = [i - 1, i, i + 1]
    .filter((n) => n >= 0 && n < ageGroups.length)
    .map((n) => ageGroups[n]);

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
    WHERE tp.user_id = ?
    ORDER BY s.is_active DESC, s.start_date DESC, t.name
  `).bind(id).all();

  return c.json(results);
});

const FEEDBACK_TYPES = ['technical', 'tactical', 'physical', 'mental', 'general'];

// GET /api/players/:id/feedback — role-based visibility
// admin/committee/coach/manager: see all; player: own only; parent: children's
app.get('/:id/feedback', async (c) => {
  const caller = c.get('user');
  const playerId = c.req.param('id');
  const callerRoles = parseRoles(caller.roles);

  const isPrivileged = callerRoles.some((r) =>
    ['admin', 'committee', 'coach', 'manager'].includes(r)
  );
  const isOwnPlayer = caller.id === playerId;
  const isParent = callerRoles.includes('parent') && !isPrivileged;

  if (!isPrivileged && !isOwnPlayer && !isParent) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  // Parent: verify this player is their child via an approved EOI
  if (isParent && !isOwnPlayer) {
    const link = await c.env.DB.prepare(
      `SELECT 1 FROM eois
       WHERE parent_guardian_email = ? AND created_user_id = ? AND status = 'approved'
       LIMIT 1`
    ).bind(caller.email, playerId).first();
    if (!link) return c.json({ error: 'Forbidden' }, 403);
  }

  const { results } = await c.env.DB.prepare(`
    SELECT pf.*,
           coach.first_name AS coach_first_name, coach.last_name AS coach_last_name
    FROM player_feedback pf
    JOIN users coach ON coach.id = pf.coach_id
    WHERE pf.player_id = ?
    ORDER BY pf.created_at DESC
  `).bind(playerId).all();

  return c.json(results);
});

// POST /api/players/:id/feedback — coach / committee / admin only
app.post('/:id/feedback', async (c) => {
  const denied = requireRole(c, ['admin', 'committee', 'coach']);
  if (denied) return denied;

  const caller = c.get('user');
  const playerId = c.req.param('id');
  const callerRoles = parseRoles(caller.roles);

  // Coaches (without admin/committee) can only submit feedback for players on their teams
  const isCoachOnly =
    callerRoles.includes('coach') &&
    !callerRoles.some((r) => ['admin', 'committee'].includes(r));

  if (isCoachOnly) {
    const onTeam = await c.env.DB.prepare(`
      SELECT 1 FROM team_coaches tc
      JOIN team_players tp ON tp.team_id = tc.team_id
      WHERE tc.user_id = ? AND tp.user_id = ?
      LIMIT 1
    `).bind(caller.id, playerId).first();
    if (!onTeam) return c.json({ error: 'Player is not on any of your teams' }, 403);
  }

  const body = await c.req.json<{
    title: string;
    content: string;
    feedback_type: string;
    rating?: number | null;
  }>();

  if (!body.title?.trim() || !body.content?.trim() || !body.feedback_type) {
    return c.json({ error: 'title, content, and feedback_type are required' }, 400);
  }
  if (!FEEDBACK_TYPES.includes(body.feedback_type)) {
    return c.json({ error: `feedback_type must be one of: ${FEEDBACK_TYPES.join(', ')}` }, 400);
  }
  if (body.rating != null && (body.rating < 1 || body.rating > 5)) {
    return c.json({ error: 'rating must be 1–5' }, 400);
  }

  const result = await c.env.DB.prepare(`
    INSERT INTO player_feedback (player_id, coach_id, title, content, feedback_type, rating)
    VALUES (?, ?, ?, ?, ?, ?)
    RETURNING *
  `).bind(
    playerId, caller.id, body.title.trim(), body.content.trim(),
    body.feedback_type, body.rating ?? null,
  ).first();

  return c.json(result, 201);
});

export default app;
