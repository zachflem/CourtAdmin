import { Hono } from 'hono';
import type { Env, HonoVariables } from '../types';
import { authMiddleware } from '../middleware/auth';
import { requireRole } from '../middleware/requireRole';

const ALLOWED_FIELDS = [
  'club_name',
  'mission_statement',
  'about_text',
  'contact_phone',
  'contact_email',
  'contact_address',
  'primary_color',
  'secondary_color',
  'accent_color',
  'social_facebook',
  'social_instagram',
  'social_twitter',
  'social_tiktok',
] as const;

const DEFAULT_ENQUIRY_TYPES = [
  { label: 'General Enquiry', forward_to: '' },
  { label: 'Membership / Registration', forward_to: '' },
  { label: 'Coaching / Volunteering', forward_to: '' },
];

const DEFAULT_AGE_GROUPS = ['U8', 'U10', 'U12', 'U14', 'U16', 'U18', 'Senior'];
const DEFAULT_DIVISIONS = ['Div 1', 'Div 2', 'Div 3'];

function parseAgeGroups(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  try { return JSON.parse(raw as string); } catch { return DEFAULT_AGE_GROUPS; }
}

function parseDivisions(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw as string[];
  try { return JSON.parse(raw as string); } catch { return DEFAULT_DIVISIONS; }
}

function parseEnquiryTypes(raw: unknown) {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) return parsed;
  } catch { /* fall through */ }
  return DEFAULT_ENQUIRY_TYPES;
}

function withParsedFields(row: Record<string, unknown>) {
  return {
    ...row,
    age_groups: parseAgeGroups(row.age_groups),
    divisions: parseDivisions(row.divisions),
    contact_enquiry_types: parseEnquiryTypes(row.contact_enquiry_types),
  };
}

const app = new Hono<{ Bindings: Env; Variables: HonoVariables }>();

app.get('/', async (c) => {
  const row = await c.env.DB.prepare('SELECT * FROM club_settings LIMIT 1').first<Record<string, unknown>>();
  if (!row) {
    return c.json({
      club_name: 'Our Club',
      mission_statement: 'Excellence in sport, community, and development.',
      about_text: 'Founded with a passion for sport and community development.',
      contact_phone: null,
      contact_email: null,
      contact_address: null,
      primary_color: '#1e40af',
      secondary_color: '#3b82f6',
      accent_color: '#f59e0b',
      logo_url: null,
      hero_image_url: null,
      about_image_url: null,
      social_facebook: null,
      social_instagram: null,
      social_twitter: null,
      social_tiktok: null,
      age_groups: DEFAULT_AGE_GROUPS,
      divisions: DEFAULT_DIVISIONS,
      contact_enquiry_types: DEFAULT_ENQUIRY_TYPES,
    });
  }
  return c.json(withParsedFields(row));
});

app.put('/', authMiddleware, async (c) => {
  const denied = requireRole(c, ['admin']);
  if (denied) return denied;

  const body = await c.req.json<Record<string, unknown>>();

  // JSON array fields — serialise separately
  const ageGroupsRaw = body.age_groups;
  const divisionsRaw = body.divisions;
  const enquiryTypesRaw = body.contact_enquiry_types;
  const entries = Object.entries(body).filter(([k]) =>
    (ALLOWED_FIELDS as readonly string[]).includes(k)
  ) as [string, string][];

  if (ageGroupsRaw !== undefined) {
    const groups = parseAgeGroups(ageGroupsRaw);
    entries.push(['age_groups', JSON.stringify(groups)]);
  }
  if (divisionsRaw !== undefined) {
    const divs = parseDivisions(divisionsRaw);
    entries.push(['divisions', JSON.stringify(divs)]);
  }
  if (enquiryTypesRaw !== undefined) {
    const types = parseEnquiryTypes(enquiryTypesRaw);
    entries.push(['contact_enquiry_types', JSON.stringify(types)]);
  }

  if (entries.length === 0) {
    return c.json({ error: 'No valid fields provided' }, 400);
  }

  const existing = await c.env.DB.prepare(
    'SELECT id FROM club_settings LIMIT 1'
  ).first<{ id: string }>();

  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO club_settings (club_name, mission_statement, about_text, primary_color, secondary_color, accent_color)
       VALUES ('Our Club', 'Excellence in sport, community, and development.',
               'Founded with a passion for sport and community development.',
               '#1e40af', '#3b82f6', '#f59e0b')`
    ).run();
  }

  const setClauses = entries.map(([k]) => `${k} = ?`).join(', ');
  const values = entries.map(([, v]) => v);

  await c.env.DB.prepare(
    `UPDATE club_settings SET ${setClauses}, updated_at = datetime('now')
     WHERE id = (SELECT id FROM club_settings LIMIT 1)`
  )
    .bind(...values)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM club_settings LIMIT 1').first<Record<string, unknown>>();
  return c.json(withParsedFields(updated!));
});

export default app;
