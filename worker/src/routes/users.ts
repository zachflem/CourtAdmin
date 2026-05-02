import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { sendEmail } from '../lib/email';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.use('/*', authMiddleware);

const ALL_ROLES = ['admin', 'committee', 'coach', 'manager', 'player', 'parent'];

const USER_SELECT = `
  id, email, first_name, last_name, phone, address, emergency_contact,
  medical_info, gender, date_of_birth, grading_level, age_group,
  jersey_number, clearance_required, clearance_status,
  previous_club_name, previous_team_name, previous_coach_name,
  first_year_registered, is_active, is_approved, roles, created_at, updated_at
`;

// GET /api/users — full user list with positions (admin/committee)
app.get('/', async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(`
    SELECT
      u.id, u.email, u.first_name, u.last_name, u.phone, u.address, u.emergency_contact,
      u.medical_info, u.gender, u.date_of_birth, u.grading_level, u.age_group,
      u.jersey_number, u.clearance_required, u.clearance_status,
      u.previous_club_name, u.previous_team_name, u.previous_coach_name,
      u.first_year_registered, u.is_active, u.is_approved, u.roles, u.created_at, u.updated_at,
      COALESCE(GROUP_CONCAT(cp.id || '~' || cp.name, '|'), '') AS positions_raw
    FROM users u
    LEFT JOIN user_positions up ON up.user_id = u.id
    LEFT JOIN club_positions cp ON cp.id = up.position_id
    GROUP BY u.id
    ORDER BY u.last_name, u.first_name
  `).all<Record<string, unknown>>();

  const users = results.map((u) => ({
    ...u,
    positions: u.positions_raw
      ? String(u.positions_raw).split('|').map((p) => {
          const tilde = p.indexOf('~');
          return { id: p.slice(0, tilde), name: p.slice(tilde + 1) };
        })
      : [],
    positions_raw: undefined,
  }));

  return c.json(users);
});

// GET /api/users/export — CSV download (admin only)
app.get('/export', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(
    `SELECT ${USER_SELECT} FROM users ORDER BY last_name, first_name`
  ).all<Record<string, unknown>>();

  const COLUMNS = [
    'id', 'email', 'first_name', 'last_name', 'phone', 'address',
    'emergency_contact', 'medical_info', 'gender', 'date_of_birth',
    'grading_level', 'age_group', 'jersey_number', 'clearance_required',
    'clearance_status', 'previous_club_name', 'previous_team_name',
    'previous_coach_name', 'first_year_registered', 'is_active',
    'is_approved', 'roles', 'created_at', 'updated_at',
  ];

  const header = COLUMNS.join(',');
  const rows = results.map((row) =>
    COLUMNS.map((col) => csvEscape(col === 'roles' ? rolesDisplay(row[col]) : row[col])).join(',')
  );

  const date = new Date().toISOString().slice(0, 10);
  const csv = [header, ...rows].join('\r\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv',
      'Content-Disposition': `attachment; filename="users-${date}.csv"`,
    },
  });
});

// POST /api/users/import — CSV upsert by email (admin only)
app.post('/import', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const body = await c.req.json<{ csv: string; sendWelcome?: boolean; customMessage?: string }>();
  if (!body?.csv) return c.json({ error: 'csv field is required' }, 400);

  const lines = body.csv.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return c.json({ error: 'CSV must have a header row and at least one data row' }, 400);

  const header = parseCsvLine(lines[0]!);
  const emailIdx = header.indexOf('email');
  if (emailIdx === -1) return c.json({ error: 'CSV must have an email column' }, 400);

  const UPDATABLE = [
    'first_name', 'last_name', 'phone', 'address', 'emergency_contact',
    'medical_info', 'gender', 'date_of_birth', 'grading_level', 'age_group',
    'jersey_number', 'clearance_required', 'clearance_status',
    'previous_club_name', 'previous_team_name', 'previous_coach_name',
    'first_year_registered', 'is_active', 'is_approved', 'roles',
  ];
  const INTEGER_COLS = new Set(['grading_level', 'jersey_number', 'clearance_required', 'is_active', 'is_approved']);

  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  const newUsers: { email: string; first_name: string }[] = [];

  for (let i = 1; i < lines.length; i++) {
    const row = parseCsvLine(lines[i]!);
    const email = row[emailIdx]?.trim().toLowerCase();
    if (!email) continue;

    const rowData: Record<string, string> = {};
    header.forEach((col, j) => { rowData[col] = (row[j] ?? '').trim(); });

    // Convert pipe-delimited roles back to JSON array
    if (rowData.roles !== undefined && !rowData.roles.startsWith('[')) {
      const parts = rowData.roles.split('|').map((r) => r.trim()).filter(Boolean);
      rowData.roles = JSON.stringify(parts);
    }

    try {
      const existing = await c.env.DB.prepare('SELECT id FROM users WHERE email = ?')
        .bind(email).first<{ id: string }>();

      if (existing) {
        const setCols = UPDATABLE.filter((col) => header.includes(col) && rowData[col] !== '');
        if (setCols.length > 0) {
          const setClause = setCols.map((col) => `${col} = ?`).join(', ');
          const vals = setCols.map((col) =>
            INTEGER_COLS.has(col) ? (rowData[col] ? Number(rowData[col]) : null) : (rowData[col] || null)
          );
          await c.env.DB.prepare(
            `UPDATE users SET ${setClause}, updated_at = datetime('now') WHERE email = ?`
          ).bind(...vals, email).run();
          updated++;
        }
      } else {
        const first_name = rowData.first_name || '';
        const last_name = rowData.last_name || '';
        const roles = rowData.roles || '[]';
        const extraCols = UPDATABLE.filter(
          (col) => col !== 'first_name' && col !== 'last_name' && col !== 'roles'
            && header.includes(col) && rowData[col] !== ''
        );
        const allCols = ['email', 'first_name', 'last_name', 'roles', ...extraCols];
        const allVals = [
          email, first_name, last_name, roles,
          ...extraCols.map((col) =>
            INTEGER_COLS.has(col) ? (rowData[col] ? Number(rowData[col]) : null) : (rowData[col] || null)
          ),
        ];
        await c.env.DB.prepare(
          `INSERT INTO users (${allCols.join(', ')}) VALUES (${allCols.map(() => '?').join(', ')})`
        ).bind(...allVals).run();
        created++;
        newUsers.push({ email, first_name });
      }
    } catch (err) {
      errors.push(`Row ${i + 1} (${email}): ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let emailsSent = 0;
  let emailErrors = 0;

  if (body.sendWelcome && newUsers.length > 0) {
    const settings = await c.env.DB.prepare(
      `SELECT club_name FROM club_settings LIMIT 1`
    ).first<{ club_name: string }>();
    const clubName = settings?.club_name || 'Your Club';
    const portalUrl = c.env.FRONTEND_URL || '';

    for (const u of newUsers) {
      try {
        const greeting = u.first_name ? `Hi ${u.first_name},` : 'Hi,';
        const customBlock = body.customMessage?.trim()
          ? `<p style="margin:16px 0;padding:12px 16px;background:#f5f5f5;border-left:3px solid #666;border-radius:4px;">${body.customMessage.trim()}</p>`
          : '';
        const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222;">
  <p style="margin:0 0 16px;">${greeting}</p>
  <p style="margin:0 0 16px;">
    An account has been created for you on the <strong>${clubName}</strong> member portal.
    The portal is used by the club to manage memberships, share updates, and communicate with players, parents, coaches, and volunteers.
  </p>
  ${customBlock}
  <p style="margin:0 0 8px;font-weight:600;">How to sign in</p>
  <p style="margin:0 0 16px;">
    Visit <a href="${portalUrl}" style="color:#2563eb;">${portalUrl}</a> and enter your email address
    (<strong>${u.email}</strong>). You'll receive a sign-in link by email — no password required.
  </p>
  <p style="margin:0;color:#666;font-size:0.9em;">— ${clubName}</p>
</div>`;
        await sendEmail(c.env, u.email, `Welcome to ${clubName}`, html);
        emailsSent++;
      } catch {
        emailErrors++;
      }
    }
  }

  return c.json({ created, updated, errors, emailsSent, emailErrors });
});

// PUT /api/users/:id — update user fields (admin only)
app.put('/:id', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const { id } = c.req.param();

  const existing = await c.env.DB.prepare('SELECT id, first_name, last_name FROM users WHERE id = ?')
    .bind(id).first<{ id: string; first_name: string; last_name: string }>();
  if (!existing) return c.json({ error: 'User not found' }, 404);

  const body = await c.req.json<{
    first_name?: string; last_name?: string; phone?: string | null;
    address?: string | null; emergency_contact?: string | null;
    medical_info?: string | null; gender?: string | null;
    date_of_birth?: string | null; grading_level?: number | null;
    age_group?: string | null; jersey_number?: number | null;
    clearance_required?: number; clearance_status?: string | null;
    previous_club_name?: string | null; previous_team_name?: string | null;
    previous_coach_name?: string | null; first_year_registered?: string | null;
    is_active?: number;
  }>();

  await c.env.DB.prepare(`
    UPDATE users SET
      first_name          = ?,
      last_name           = ?,
      phone               = ?,
      address             = ?,
      emergency_contact   = ?,
      medical_info        = ?,
      gender              = ?,
      date_of_birth       = ?,
      grading_level       = ?,
      age_group           = ?,
      jersey_number       = ?,
      clearance_required  = ?,
      clearance_status    = ?,
      previous_club_name  = ?,
      previous_team_name  = ?,
      previous_coach_name = ?,
      first_year_registered = ?,
      is_active           = ?,
      updated_at          = datetime('now')
    WHERE id = ?
  `).bind(
    body.first_name  || existing.first_name,
    body.last_name   || existing.last_name,
    body.phone               ?? null,
    body.address             ?? null,
    body.emergency_contact   ?? null,
    body.medical_info        ?? null,
    body.gender              ?? null,
    body.date_of_birth       ?? null,
    body.grading_level       != null ? Number(body.grading_level)  : null,
    body.age_group           ?? null,
    body.jersey_number       != null ? Number(body.jersey_number)  : null,
    body.clearance_required  != null ? Number(body.clearance_required) : 0,
    body.clearance_status    ?? null,
    body.previous_club_name  ?? null,
    body.previous_team_name  ?? null,
    body.previous_coach_name ?? null,
    body.first_year_registered ?? null,
    body.is_active != null ? Number(body.is_active) : 1,
    id,
  ).run();

  const updated = await c.env.DB.prepare(
    `SELECT ${USER_SELECT} FROM users WHERE id = ?`
  ).bind(id).first();

  return c.json(updated);
});

// PUT /api/users/:id/roles — set roles array (admin only)
app.put('/:id/roles', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const { id } = c.req.param();
  const body = await c.req.json<{ roles: string[] }>();

  if (!Array.isArray(body.roles)) return c.json({ error: 'roles must be an array' }, 400);
  if (!body.roles.every((r) => ALL_ROLES.includes(r))) {
    return c.json({ error: `roles must be from: ${ALL_ROLES.join(', ')}` }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(id).first<{ id: string }>();
  if (!existing) return c.json({ error: 'User not found' }, 404);

  await c.env.DB.prepare(
    `UPDATE users SET roles = ?, updated_at = datetime('now') WHERE id = ?`
  ).bind(JSON.stringify(body.roles), id).run();

  return c.json({ id, roles: body.roles });
});

// PUT /api/users/:id/positions — replace user's positions (admin)
app.put('/:id/positions', async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const { id } = c.req.param();
  const body = await c.req.json<{ position_ids: string[] }>();

  if (!Array.isArray(body.position_ids)) {
    return c.json({ error: 'position_ids must be an array' }, 400);
  }

  const existing = await c.env.DB.prepare('SELECT id FROM users WHERE id = ?')
    .bind(id).first<{ id: string }>();
  if (!existing) return c.json({ error: 'User not found' }, 404);

  const stmts = [
    c.env.DB.prepare('DELETE FROM user_positions WHERE user_id = ?').bind(id),
    ...body.position_ids.map((posId) =>
      c.env.DB.prepare(
        `INSERT INTO user_positions (user_id, position_id) VALUES (?, ?)`
      ).bind(id, posId)
    ),
  ];

  await c.env.DB.batch(stmts);

  return c.json({ id, position_ids: body.position_ids });
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function rolesDisplay(val: unknown): string {
  if (typeof val !== 'string') return '';
  try {
    const arr = JSON.parse(val) as string[];
    return arr.join('|');
  } catch {
    return String(val);
  }
}

function csvEscape(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let i = 0;
  while (i <= line.length) {
    if (line[i] === '"') {
      i++;
      let val = '';
      while (i < line.length) {
        if (line[i] === '"' && line[i + 1] === '"') {
          val += '"';
          i += 2;
        } else if (line[i] === '"') {
          i++;
          break;
        } else {
          val += line[i++];
        }
      }
      result.push(val);
      if (line[i] === ',') i++;
    } else {
      const end = line.indexOf(',', i);
      if (end === -1) {
        result.push(line.slice(i));
        break;
      }
      result.push(line.slice(i, end));
      i = end + 1;
    }
  }
  return result;
}

export default app;
