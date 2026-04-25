import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';

const auth = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

auth.get('/me', (c) => {
  const user = c.get('user');
  return c.json({
    id: user.id,
    email: user.email,
    first_name: user.first_name,
    last_name: user.last_name,
    roles: JSON.parse(user.roles || '[]'),
    is_active: user.is_active,
    jersey_number: user.jersey_number,
    age_group: user.age_group,
    grading_level: user.grading_level,
    first_year_registered: user.first_year_registered,
  });
});

export default auth;
