import type { Context } from 'hono';
import type { Env, HonoVariables, Role } from '../types';

export function requireRole(
  c: Context<{ Bindings: Env; Variables: HonoVariables }>,
  roles: Role[]
): Response | null {
  const user = c.get('user');
  let userRoles: string[] = [];
  try {
    userRoles = JSON.parse(user.roles);
  } catch {
    // malformed roles — treat as empty
  }

  const hasRole = roles.some((r) => userRoles.includes(r));
  if (!hasRole) {
    return c.json({ error: 'Forbidden' }, 403);
  }
  return null;
}
