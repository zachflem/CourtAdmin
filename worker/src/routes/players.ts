import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];

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

export default app;
