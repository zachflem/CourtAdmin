import type { Context, Next } from 'hono';
import type { Env, HonoVariables, User } from '../types';

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: HonoVariables }>,
  next: Next
): Promise<Response | void> {
  const email =
    c.req.header('CF-Access-Authenticated-User-Email') ||
    // Dev bypass: set CF_DEV_EMAIL env var or pass X-Dev-Email header in local dev only
    (c.env.CF_ACCESS_AUD === 'dev' ? c.req.header('X-Dev-Email') : undefined);

  if (!email) {
    return c.json({ error: 'Unauthorized' }, 401);
  }

  let user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE email = ?'
  )
    .bind(email)
    .first<User>();

  if (!user) {
    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const isAdminSeed = c.env.ADMIN_SEED_EMAIL &&
      email.toLowerCase() === c.env.ADMIN_SEED_EMAIL.toLowerCase();
    const roles = JSON.stringify(isAdminSeed ? ['admin'] : []);
    await c.env.DB.prepare(
      `INSERT INTO users (id, email, roles, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?)`
    )
      .bind(id, email, roles, now, now)
      .run();

    user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE id = ?'
    )
      .bind(id)
      .first<User>();
  }

  if (!user) {
    return c.json({ error: 'Failed to provision user' }, 500);
  }

  c.set('user', user);
  await next();
}
