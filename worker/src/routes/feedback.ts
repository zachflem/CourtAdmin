import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

function parseRoles(s: string | null | undefined): string[] {
  try { return JSON.parse(s || '[]'); } catch { return []; }
}

const FEEDBACK_JOIN = `
  SELECT pf.*,
         p.first_name AS player_first_name, p.last_name AS player_last_name,
         p.age_group  AS player_age_group,
         c.first_name AS coach_first_name,  c.last_name  AS coach_last_name
  FROM player_feedback pf
  JOIN users p ON p.id = pf.player_id
  JOIN users c ON c.id = pf.coach_id
`;

// GET /api/feedback — all feedback (admin / committee)
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(
    `${FEEDBACK_JOIN} ORDER BY pf.created_at DESC`
  ).all();

  return c.json(results);
});

// GET /api/feedback/my-teams — feedback for players on the caller's coached teams
app.get('/my-teams', async (c) => {
  const caller = c.get('user');
  const callerRoles = parseRoles(caller.roles);
  if (!callerRoles.some((r) => ['coach', 'admin', 'committee'].includes(r))) {
    return c.json({ error: 'Forbidden' }, 403);
  }

  const { results } = await c.env.DB.prepare(`
    ${FEEDBACK_JOIN}
    WHERE pf.player_id IN (
      SELECT DISTINCT tp.user_id
      FROM team_coaches tc
      JOIN team_players tp ON tp.team_id = tc.team_id
      WHERE tc.user_id = ?
    )
    ORDER BY pf.created_at DESC
  `).bind(caller.id).all();

  return c.json(results);
});

export default app;
