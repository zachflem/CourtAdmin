import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.get('/', async (c) => {
  const [players, teams, staff] = await Promise.all([
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM users WHERE is_active = 1 AND roles LIKE '%"player"%'`
    ).first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(*) as count FROM teams t
       JOIN seasons s ON t.season_id = s.id
       WHERE s.is_active = 1`
    ).first<{ count: number }>(),
    c.env.DB.prepare(
      `SELECT COUNT(DISTINCT id) as count FROM users
       WHERE is_active = 1
         AND (roles LIKE '%"coach"%' OR roles LIKE '%"manager"%')`
    ).first<{ count: number }>(),
  ]);

  return c.json({
    active_players: players?.count ?? 0,
    active_teams: teams?.count ?? 0,
    coaches_and_staff: staff?.count ?? 0,
  });
});

export default app;
