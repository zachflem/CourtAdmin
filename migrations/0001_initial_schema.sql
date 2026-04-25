-- Migration 0001: Initial schema

CREATE TABLE IF NOT EXISTS club_settings (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  club_name TEXT NOT NULL DEFAULT 'Our Club',
  mission_statement TEXT NOT NULL DEFAULT 'Excellence in sport, community, and development.',
  about_text TEXT NOT NULL DEFAULT 'Founded with a passion for sport and community development.',
  contact_phone TEXT,
  contact_email TEXT,
  contact_address TEXT,
  primary_color TEXT NOT NULL DEFAULT '#1e40af',
  secondary_color TEXT NOT NULL DEFAULT '#3b82f6',
  accent_color TEXT NOT NULL DEFAULT '#f59e0b',
  logo_url TEXT,
  hero_image_url TEXT,
  about_image_url TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  email TEXT NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  phone TEXT,
  address TEXT,
  emergency_contact TEXT,
  medical_info TEXT,
  gender TEXT,
  date_of_birth TEXT,
  grading_level INTEGER,
  first_year_registered TEXT,
  jersey_number INTEGER,
  clearance_required INTEGER NOT NULL DEFAULT 0,
  clearance_status TEXT NOT NULL DEFAULT 'Not Required',
  previous_club_name TEXT,
  previous_team_name TEXT,
  previous_coach_name TEXT,
  roles TEXT NOT NULL DEFAULT '[]',        -- JSON array e.g. '["player","coach"]'
  is_active INTEGER NOT NULL DEFAULT 1,
  is_approved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS seasons (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  age_cutoff_date TEXT NOT NULL,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_closed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  season_id TEXT NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  age_group TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS team_players (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_coaches (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS team_managers (
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS eois (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  date_of_birth TEXT NOT NULL,
  gender TEXT NOT NULL,
  grading_level INTEGER NOT NULL,
  experience_level TEXT NOT NULL,
  season_interest TEXT NOT NULL,
  emergency_contact_name TEXT NOT NULL,
  emergency_contact_phone TEXT NOT NULL,
  additional_notes TEXT,
  parent_guardian_name TEXT,
  parent_guardian_email TEXT,
  parent_guardian_phone TEXT,
  relationship_to_player TEXT,
  clearance_required INTEGER NOT NULL DEFAULT 0,
  previous_club_name TEXT,
  previous_team_name TEXT,
  previous_coach_name TEXT,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | approved | rejected
  submitted_by_user_id TEXT REFERENCES users(id),
  processed_by TEXT REFERENCES users(id),
  processed_at TEXT,
  notes TEXT,
  assigned_teams TEXT NOT NULL DEFAULT '[]',  -- JSON array of team IDs
  created_user_id TEXT REFERENCES users(id),
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS player_feedback (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  player_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coach_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  feedback_type TEXT NOT NULL,  -- technical | tactical | physical | mental | general
  rating INTEGER,               -- 1-5, nullable
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_templates (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS email_campaigns (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  content TEXT NOT NULL,
  recipients TEXT NOT NULL DEFAULT '[]',  -- JSON array of user IDs
  sender_id TEXT NOT NULL REFERENCES users(id),
  template_id TEXT REFERENCES email_templates(id),
  status TEXT NOT NULL DEFAULT 'draft',   -- draft | sending | sent | failed
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS role_requests (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  requested_roles TEXT NOT NULL DEFAULT '[]',  -- JSON array
  justification TEXT,
  status TEXT NOT NULL DEFAULT 'pending',      -- pending | approved | rejected
  processed_by TEXT REFERENCES users(id),
  processed_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_eois_status ON eois(status);
CREATE INDEX IF NOT EXISTS idx_eois_email ON eois(email);
CREATE INDEX IF NOT EXISTS idx_teams_season ON teams(season_id);
CREATE INDEX IF NOT EXISTS idx_feedback_player ON player_feedback(player_id);
CREATE INDEX IF NOT EXISTS idx_feedback_coach ON player_feedback(coach_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_user ON role_requests(user_id);
CREATE INDEX IF NOT EXISTS idx_role_requests_status ON role_requests(status);
