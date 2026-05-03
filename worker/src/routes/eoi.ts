import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';
import { sendEmail } from '../lib/email';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

const DEFAULT_AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];

async function getAgeGroups(db: D1Database): Promise<string[]> {
  const row = await db.prepare(
    `SELECT age_groups FROM club_settings LIMIT 1`
  ).first<{ age_groups: string }>();
  if (!row) return DEFAULT_AGE_GROUPS;
  try { return JSON.parse(row.age_groups); } catch { return DEFAULT_AGE_GROUPS; }
}

function calculateAge(dob: string, cutoffDate: string): number {
  const birth = new Date(dob);
  const cutoff = new Date(cutoffDate);
  let age = cutoff.getFullYear() - birth.getFullYear();
  const m = cutoff.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && cutoff.getDate() < birth.getDate())) age--;
  return age;
}

function ageToGroup(age: number): string {
  if (age < 8) return 'U8';
  if (age < 10) return 'U10';
  if (age < 12) return 'U12';
  if (age < 14) return 'U14';
  if (age < 16) return 'U16';
  if (age < 18) return 'U18';
  return 'Senior';
}

function adjacentGroups(ageGroup: string, ageGroups: string[]): string[] {
  const i = ageGroups.indexOf(ageGroup);
  if (i === -1) return [ageGroup];
  const indices = [i - 1, i, i + 1].filter((n) => n >= 0 && n < ageGroups.length);
  return indices.map((n) => ageGroups[n] as string);
}


// ── Authenticated routes ─────────────────────────────────────────────────────

// GET /api/eoi — all EOIs (admin/committee)
app.get('/', authMiddleware, async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { results } = await c.env.DB.prepare(
    `SELECT e.*,
            s.name AS season_name,
            s.age_cutoff_date,
            u.first_name AS processor_first_name,
            u.last_name  AS processor_last_name
     FROM eois e
     LEFT JOIN seasons s ON s.id = e.season_interest
     LEFT JOIN users   u ON u.id = e.processed_by
     ORDER BY e.submitted_at DESC`
  ).all();

  return c.json(results);
});

// GET /api/eoi/:id/calculated-age-group
app.get('/:id/calculated-age-group', authMiddleware, async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();

  const eoi = await c.env.DB.prepare(
    'SELECT date_of_birth, season_interest FROM eois WHERE id = ?'
  ).bind(id).first<{ date_of_birth: string; season_interest: string }>();

  if (!eoi) return c.json({ error: 'EOI not found' }, 404);

  const season = await c.env.DB.prepare(
    'SELECT age_cutoff_date FROM seasons WHERE id = ?'
  ).bind(eoi.season_interest).first<{ age_cutoff_date: string }>();

  if (!season) return c.json({ error: 'Season not found' }, 404);

  const age = calculateAge(eoi.date_of_birth, season.age_cutoff_date);
  const age_group = ageToGroup(age);

  return c.json({ age_group, age, age_cutoff_date: season.age_cutoff_date });
});

// PUT /api/eoi/:id — approve or reject
app.put('/:id', authMiddleware, async (c) => {
  const denied = requireRole(c, ['admin', 'committee']);
  if (denied) return denied;

  const { id } = c.req.param();
  const processor = c.get('user');

  const eoi = await c.env.DB.prepare('SELECT * FROM eois WHERE id = ?')
    .bind(id)
    .first<{
      id: string; first_name: string; last_name: string; email: string;
      phone: string | null; date_of_birth: string; gender: string;
      grading_level: number; experience_level: string; season_interest: string;
      emergency_contact_name: string; emergency_contact_phone: string;
      additional_notes: string | null;
      parent_guardian_name: string | null; parent_guardian_email: string | null;
      parent_guardian_phone: string | null; relationship_to_player: string | null;
      clearance_required: number;
      previous_club_name: string | null; previous_team_name: string | null;
      previous_coach_name: string | null;
      status: string;
    }>();

  if (!eoi) return c.json({ error: 'EOI not found' }, 404);
  if (eoi.status !== 'pending') {
    return c.json({ error: 'EOI has already been processed' }, 400);
  }

  const body = await c.req.json<{
    action: 'approve' | 'reject';
    jersey_number?: number;
    team_ids?: string[];
    notes?: string;
  }>();

  if (!body.action) return c.json({ error: 'action is required' }, 400);

  // ── Reject ──────────────────────────────────────────────────────────────────
  if (body.action === 'reject') {
    await c.env.DB.prepare(
      `UPDATE eois
       SET status = 'rejected', notes = ?, processed_by = ?, processed_at = datetime('now'), updated_at = datetime('now')
       WHERE id = ?`
    ).bind(body.notes ?? null, processor.id, id).run();

    return c.json({ status: 'rejected' });
  }

  // ── Approve ─────────────────────────────────────────────────────────────────
  if (body.action !== 'approve') {
    return c.json({ error: "action must be 'approve' or 'reject'" }, 400);
  }

  if (!body.jersey_number || body.jersey_number < 1 || body.jersey_number > 99) {
    return c.json({ error: 'jersey_number (1–99) is required for approval' }, 400);
  }

  // Calculate age group
  const season = await c.env.DB.prepare(
    'SELECT age_cutoff_date FROM seasons WHERE id = ?'
  ).bind(eoi.season_interest).first<{ age_cutoff_date: string }>();

  if (!season) return c.json({ error: 'Season not found' }, 404);

  const age = calculateAge(eoi.date_of_birth, season.age_cutoff_date);
  const age_group = ageToGroup(age);
  const isMinor = age < 18;

  // Check jersey conflict in adjacent age groups
  const ageGroups = await getAgeGroups(c.env.DB);
  const nearby = adjacentGroups(age_group, ageGroups);
  const placeholders = nearby.map(() => '?').join(', ');
  const conflict = await c.env.DB.prepare(
    `SELECT id FROM users WHERE jersey_number = ? AND age_group IN (${placeholders}) AND is_active = 1`
  ).bind(body.jersey_number, ...nearby).first();

  if (conflict) {
    return c.json({ error: `Jersey #${body.jersey_number} is already taken in this or an adjacent age group` }, 409);
  }

  // Create or update player user
  const existingUser = await c.env.DB.prepare(
    'SELECT id, roles FROM users WHERE email = ?'
  ).bind(eoi.email).first<{ id: string; roles: string }>();

  let playerId: string;

  if (existingUser) {
    // Merge player role in
    const roles: string[] = JSON.parse(existingUser.roles || '[]');
    if (!roles.includes('player')) roles.push('player');

    await c.env.DB.prepare(
      `UPDATE users
       SET first_name = ?, last_name = ?, phone = ?, gender = ?, date_of_birth = ?,
           grading_level = ?, age_group = ?, jersey_number = ?,
           clearance_required = ?, clearance_status = ?,
           previous_club_name = ?, previous_team_name = ?, previous_coach_name = ?,
           emergency_contact = ?, first_year_registered = date('now'),
           roles = ?, is_active = 1, is_approved = 1,
           updated_at = datetime('now')
       WHERE id = ?`
    ).bind(
      eoi.first_name, eoi.last_name, eoi.phone, eoi.gender, eoi.date_of_birth,
      eoi.grading_level, age_group, body.jersey_number,
      eoi.clearance_required, eoi.clearance_required ? 'Pending' : 'Not Required',
      eoi.previous_club_name, eoi.previous_team_name, eoi.previous_coach_name,
      `${eoi.emergency_contact_name} — ${eoi.emergency_contact_phone}`,
      JSON.stringify(roles),
      existingUser.id,
    ).run();

    playerId = existingUser.id;
  } else {
    const newUser = await c.env.DB.prepare(
      `INSERT INTO users (
         email, first_name, last_name, phone, gender, date_of_birth,
         grading_level, age_group, jersey_number,
         clearance_required, clearance_status,
         previous_club_name, previous_team_name, previous_coach_name,
         emergency_contact, first_year_registered,
         roles, is_active, is_approved
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, date('now'), '["player"]', 1, 1)
       RETURNING id`
    ).bind(
      eoi.email, eoi.first_name, eoi.last_name, eoi.phone, eoi.gender, eoi.date_of_birth,
      eoi.grading_level, age_group, body.jersey_number,
      eoi.clearance_required, eoi.clearance_required ? 'Pending' : 'Not Required',
      eoi.previous_club_name, eoi.previous_team_name, eoi.previous_coach_name,
      `${eoi.emergency_contact_name} — ${eoi.emergency_contact_phone}`,
    ).first<{ id: string }>();

    playerId = newUser!.id;
  }

  // Assign to teams
  const teamIds: string[] = body.team_ids ?? [];
  if (teamIds.length > 0) {
    const inserts = teamIds.map((tid) =>
      c.env.DB.prepare(
        'INSERT OR IGNORE INTO team_players (team_id, user_id) VALUES (?, ?)'
      ).bind(tid, playerId)
    );
    await c.env.DB.batch(inserts);
  }

  // Handle parent account for minors
  let parentId: string | null = null;
  if (isMinor && eoi.parent_guardian_email) {
    const existingParent = await c.env.DB.prepare(
      'SELECT id, roles FROM users WHERE email = ?'
    ).bind(eoi.parent_guardian_email).first<{ id: string; roles: string }>();

    if (existingParent) {
      const roles: string[] = JSON.parse(existingParent.roles || '[]');
      if (!roles.includes('parent')) roles.push('parent');
      await c.env.DB.prepare(
        `UPDATE users SET roles = ?, is_approved = 1, updated_at = datetime('now') WHERE id = ?`
      ).bind(JSON.stringify(roles), existingParent.id).run();
      parentId = existingParent.id;
    } else {
      const nameParts = (eoi.parent_guardian_name ?? '').split(' ');
      const parentFirst = nameParts[0] ?? '';
      const parentLast = nameParts.slice(1).join(' ') || '';

      const newParent = await c.env.DB.prepare(
        `INSERT INTO users (email, first_name, last_name, phone, roles, is_active, is_approved)
         VALUES (?, ?, ?, ?, '["parent"]', 1, 1)
         RETURNING id`
      ).bind(
        eoi.parent_guardian_email, parentFirst, parentLast,
        eoi.parent_guardian_phone ?? null,
      ).first<{ id: string }>();

      parentId = newParent!.id;
    }

    // Link parent → child in user_parents
    await c.env.DB.prepare(
      `INSERT OR IGNORE INTO user_parents (parent_user_id, child_user_id, relationship)
       VALUES (?, ?, ?)`
    ).bind(parentId, playerId, eoi.relationship_to_player ?? null).run();
  }

  // Update EOI record
  await c.env.DB.prepare(
    `UPDATE eois
     SET status = 'approved',
         created_user_id = ?,
         processed_by = ?,
         processed_at = datetime('now'),
         assigned_teams = ?,
         notes = ?,
         updated_at = datetime('now')
     WHERE id = ?`
  ).bind(
    playerId,
    processor.id,
    JSON.stringify(teamIds),
    body.notes ?? null,
    id,
  ).run();

  // Send welcome emails (non-fatal)
  const clubSettings = await c.env.DB.prepare(
    'SELECT club_name FROM club_settings LIMIT 1'
  ).first<{ club_name: string }>();
  const clubName = clubSettings?.club_name ?? 'the club';
  const dashboardUrl = c.env.FRONTEND_URL ? `${c.env.FRONTEND_URL}/dashboard` : '/dashboard';

  try {
    await sendEmail(
      c.env,
      eoi.email,
      `Welcome to ${clubName}!`,
      `<p>Hi ${eoi.first_name},</p>
       <p>Your application has been approved. You can now access the ${clubName} member portal.</p>
       <p>Your details: Age group <strong>${age_group}</strong>, Jersey <strong>#${body.jersey_number}</strong>.</p>
       <p><a href="${dashboardUrl}">Access the member portal</a></p>
       <p>— ${clubName}</p>`,
    );
  } catch { /* non-fatal */ }

  if (parentId && eoi.parent_guardian_email) {
    try {
      await sendEmail(
        c.env,
        eoi.parent_guardian_email,
        `Welcome to ${clubName} — parent account`,
        `<p>Hi${eoi.parent_guardian_name ? ` ${eoi.parent_guardian_name}` : ''},</p>
         <p>A parent account has been created for you at ${clubName} linked to ${eoi.first_name} ${eoi.last_name}.</p>
         <p><a href="${dashboardUrl}">Access the member portal</a></p>
         <p>— ${clubName}</p>`,
      );
    } catch { /* non-fatal */ }
  }

  return c.json({ status: 'approved', player_id: playerId, age_group, parent_id: parentId });
});

// ── Public route (no auth) ───────────────────────────────────────────────────

interface EOIBody {
  first_name: string; last_name: string; email: string; phone?: string;
  date_of_birth: string; gender: string; grading_level: number;
  experience_level: string; season_interest: string;
  emergency_contact_name: string; emergency_contact_phone: string;
  additional_notes?: string;
  parent_guardian_name?: string; parent_guardian_email?: string;
  parent_guardian_phone?: string; relationship_to_player?: string;
  clearance_required?: boolean;
  previous_club_name?: string; previous_team_name?: string; previous_coach_name?: string;
}

app.post('/', async (c) => {
  const body = await c.req.json<EOIBody>();

  const {
    first_name, last_name, email, date_of_birth, gender,
    grading_level, experience_level, season_interest,
    emergency_contact_name, emergency_contact_phone,
  } = body;

  if (
    !first_name || !last_name || !email || !date_of_birth || !gender ||
    !grading_level || !experience_level || !season_interest ||
    !emergency_contact_name || !emergency_contact_phone
  ) {
    return c.json({ error: 'Missing required fields' }, 400);
  }

  if (grading_level < 1 || grading_level > 5) {
    return c.json({ error: 'grading_level must be between 1 and 5' }, 400);
  }

  const season = await c.env.DB.prepare(
    'SELECT id, name FROM seasons WHERE id = ? AND is_active = 1 AND is_closed = 0'
  ).bind(season_interest).first<{ id: string; name: string }>();

  if (!season) return c.json({ error: 'Selected season is not available' }, 400);

  const clearance_required = body.clearance_required ? 1 : 0;

  const result = await c.env.DB.prepare(`
    INSERT INTO eois (
      first_name, last_name, email, phone, date_of_birth,
      gender, grading_level, experience_level, season_interest,
      emergency_contact_name, emergency_contact_phone, additional_notes,
      parent_guardian_name, parent_guardian_email, parent_guardian_phone,
      relationship_to_player, clearance_required,
      previous_club_name, previous_team_name, previous_coach_name
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING id, submitted_at
  `).bind(
    first_name, last_name, email,
    body.phone ?? null, date_of_birth,
    gender, grading_level, experience_level, season_interest,
    emergency_contact_name, emergency_contact_phone,
    body.additional_notes ?? null,
    body.parent_guardian_name ?? null, body.parent_guardian_email ?? null,
    body.parent_guardian_phone ?? null, body.relationship_to_player ?? null,
    clearance_required,
    body.previous_club_name ?? null, body.previous_team_name ?? null,
    body.previous_coach_name ?? null,
  ).first();

  try {
    const clubSettings = await c.env.DB.prepare(
      'SELECT club_name FROM club_settings LIMIT 1'
    ).first<{ club_name: string }>();
    const clubName = clubSettings?.club_name ?? 'the club';

    await sendEmail(
      c.env,
      email,
      `Expression of Interest received — ${clubName}`,
      `<p>Hi ${first_name},</p>
       <p>Thank you for submitting your Expression of Interest for <strong>${season.name}</strong>.
       We've received your application and will be in touch soon.</p>
       <p>— ${clubName}</p>`,
    );
  } catch { /* non-fatal */ }

  return c.json(result, 201);
});

export default app;
