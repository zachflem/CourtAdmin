import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const TEAM_WITH_COUNTS = `
  SELECT t.*, s.name AS season_name,
    (SELECT COUNT(*) FROM team_players WHERE team_id = t.id) AS player_count,
    (SELECT COUNT(*) FROM team_coaches  WHERE team_id = t.id) AS coach_count,
    (SELECT COUNT(*) FROM team_managers WHERE team_id = t.id) AS manager_count
  FROM teams t
  LEFT JOIN seasons s ON s.id = t.season_id
`;

// All endpoints require auth + committee/admin
app.use('/*', authMiddleware);

// GET /api/teams?season_id= — list teams (optionally filtered by season)
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const seasonId = c.req.query('season_id');
  const sql = seasonId
    ? `${TEAM_WITH_COUNTS} WHERE t.season_id = ? ORDER BY s.start_date DESC, t.age_group, t.name`
    : `${TEAM_WITH_COUNTS} ORDER BY s.start_date DESC, t.age_group, t.name`;

  const { results } = seasonId
    ? await c.env.DB.prepare(sql).bind(seasonId).all()
    : await c.env.DB.prepare(sql).all();

  return c.json(results);
});

// GET /api/teams/by-age-group/:age_group — must be defined before /:id
app.get('/by-age-group/:age_group', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const ageGroup = c.req.param('age_group');
  const { results } = await c.env.DB.prepare(
    `${TEAM_WITH_COUNTS} WHERE t.age_group = ? ORDER BY s.start_date DESC, t.name`
  )
    .bind(ageGroup)
    .all();

  return c.json(results);
});

// GET /api/teams/:id — team with full member lists
app.get('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const team = await c.env.DB.prepare(
    `${TEAM_WITH_COUNTS} WHERE t.id = ?`
  )
    .bind(id)
    .first();

  if (!team) return c.json({ error: 'Team not found' }, 404);

  const [players, coaches, managers] = await c.env.DB.batch([
    c.env.DB.prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email, u.jersey_number, u.age_group
       FROM users u JOIN team_players tp ON tp.user_id = u.id
       WHERE tp.team_id = ? ORDER BY u.last_name, u.first_name`
    ).bind(id),
    c.env.DB.prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM users u JOIN team_coaches tc ON tc.user_id = u.id
       WHERE tc.team_id = ? ORDER BY u.last_name, u.first_name`
    ).bind(id),
    c.env.DB.prepare(
      `SELECT u.id, u.first_name, u.last_name, u.email
       FROM users u JOIN team_managers tm ON tm.user_id = u.id
       WHERE tm.team_id = ? ORDER BY u.last_name, u.first_name`
    ).bind(id),
  ]);

  return c.json({
    ...team,
    players: players?.results ?? [],
    coaches: coaches?.results ?? [],
    managers: managers?.results ?? [],
  });
});

// POST /api/teams — create team
app.post('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const body = await c.req.json<{
    name: string;
    season_id: string;
    age_group: string;
    division?: string;
  }>();

  const { name, season_id, age_group } = body;
  if (!name || !season_id || !age_group) {
    return c.json({ error: 'name, season_id, and age_group are required' }, 400);
  }

  const season = await c.env.DB.prepare('SELECT id FROM seasons WHERE id = ?')
    .bind(season_id)
    .first();
  if (!season) return c.json({ error: 'Season not found' }, 404);

  const team = await c.env.DB.prepare(
    `INSERT INTO teams (name, season_id, age_group, division) VALUES (?, ?, ?, ?) RETURNING *`
  )
    .bind(name, season_id, age_group, body.division ?? null)
    .first();

  return c.json(team, 201);
});

// PUT /api/teams/:id — update fields and/or manage members
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();

  const existing = await c.env.DB.prepare('SELECT id FROM teams WHERE id = ?')
    .bind(id)
    .first();
  if (!existing) return c.json({ error: 'Team not found' }, 404);

  const body = await c.req.json<{
    name?: string;
    age_group?: string;
    division?: string | null;
    add_players?: string[];
    remove_players?: string[];
    add_coaches?: string[];
    remove_coaches?: string[];
    add_managers?: string[];
    remove_managers?: string[];
  }>();

  const statements: D1PreparedStatement[] = [];

  // Basic field updates
  const fieldUpdates: [string, string | null][] = [];
  if (body.name !== undefined) fieldUpdates.push(['name', body.name]);
  if (body.age_group !== undefined) fieldUpdates.push(['age_group', body.age_group]);
  if (body.division !== undefined) fieldUpdates.push(['division', body.division ?? null]);

  if (fieldUpdates.length > 0) {
    const setClauses = fieldUpdates.map(([k]) => `${k} = ?`).join(', ');
    statements.push(
      c.env.DB.prepare(
        `UPDATE teams SET ${setClauses}, updated_at = datetime('now') WHERE id = ?`
      ).bind(...fieldUpdates.map(([, v]) => v), id)
    );
  }

  // Junction table operations
  const ops: { action: 'add' | 'remove'; table: string; ids: string[] }[] = [
    { action: 'add',    table: 'team_players',  ids: body.add_players    ?? [] },
    { action: 'remove', table: 'team_players',  ids: body.remove_players ?? [] },
    { action: 'add',    table: 'team_coaches',  ids: body.add_coaches    ?? [] },
    { action: 'remove', table: 'team_coaches',  ids: body.remove_coaches ?? [] },
    { action: 'add',    table: 'team_managers', ids: body.add_managers   ?? [] },
    { action: 'remove', table: 'team_managers', ids: body.remove_managers ?? [] },
  ];

  for (const { action, table, ids } of ops) {
    for (const userId of ids) {
      if (action === 'add') {
        statements.push(
          c.env.DB.prepare(
            `INSERT OR IGNORE INTO ${table} (team_id, user_id) VALUES (?, ?)`
          ).bind(id, userId)
        );
      } else {
        statements.push(
          c.env.DB.prepare(
            `DELETE FROM ${table} WHERE team_id = ? AND user_id = ?`
          ).bind(id, userId)
        );
      }
    }
  }

  if (statements.length > 0) {
    await c.env.DB.batch(statements);
  }

  // Return updated team with counts
  const updated = await c.env.DB.prepare(
    `${TEAM_WITH_COUNTS} WHERE t.id = ?`
  )
    .bind(id)
    .first();

  return c.json(updated);
});

export default app;
