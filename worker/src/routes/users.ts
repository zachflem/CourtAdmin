import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

// GET /api/users — basic user list for admin/committee (team member search, etc.)
// Full User Management UI is Phase 8.
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(
    `SELECT id, first_name, last_name, email, roles, is_active
     FROM users
     ORDER BY last_name, first_name`
  ).all();

  return c.json(results);
});

export default app;
