import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

interface EOIBody {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  date_of_birth: string;
  gender: string;
  grading_level: number;
  experience_level: string;
  season_interest: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  additional_notes?: string;
  parent_guardian_name?: string;
  parent_guardian_email?: string;
  parent_guardian_phone?: string;
  relationship_to_player?: string;
  clearance_required?: boolean;
  previous_club_name?: string;
  previous_team_name?: string;
  previous_coach_name?: string;
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

  // Confirm the selected season is still open
  const season = await c.env.DB.prepare(
    'SELECT id, name FROM seasons WHERE id = ? AND is_active = 1 AND is_closed = 0'
  ).bind(season_interest).first<{ id: string; name: string }>();

  if (!season) {
    return c.json({ error: 'Selected season is not available' }, 400);
  }

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
    body.parent_guardian_name ?? null,
    body.parent_guardian_email ?? null,
    body.parent_guardian_phone ?? null,
    body.relationship_to_player ?? null,
    clearance_required,
    body.previous_club_name ?? null,
    body.previous_team_name ?? null,
    body.previous_coach_name ?? null,
  ).first();

  // Confirmation email — non-fatal if it fails
  try {
    const clubSettings = await c.env.DB.prepare(
      'SELECT club_name FROM club_settings LIMIT 1'
    ).first<{ club_name: string }>();
    const clubName = clubSettings?.club_name ?? 'the club';
    const fromEmail = c.env.RESEND_FROM_EMAIL || 'onboarding@resend.dev';

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${c.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: email,
        subject: `Expression of Interest received — ${clubName}`,
        html: `
          <p>Hi ${first_name},</p>
          <p>Thank you for submitting your Expression of Interest for <strong>${season.name}</strong>.
          We've received your application and will be in touch soon.</p>
          <p>If you have any questions in the meantime, please don't hesitate to contact us.</p>
          <p>— ${clubName}</p>
        `,
      }),
    });
  } catch {
    // Email failure is non-fatal — EOI is saved regardless
  }

  return c.json(result, 201);
});

export default app;
