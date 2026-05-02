CREATE TABLE grading_sessions (
  id TEXT PRIMARY KEY,
  season_id TEXT NOT NULL REFERENCES seasons(id),
  name TEXT NOT NULL,
  age_group TEXT NOT NULL,
  gender TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  notes TEXT,
  conducted_by TEXT REFERENCES users(id),
  conducted_at TEXT,
  created_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE grading_session_players (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES grading_sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  snapshot_name TEXT NOT NULL,
  snapshot_dob TEXT,
  snapshot_age_group TEXT,
  snapshot_gender TEXT,
  snapshot_grading_level INTEGER,
  snapshot_previous_teams TEXT,
  new_grading_level INTEGER,
  division_recommendation TEXT,
  coach_notes TEXT,
  entered_by TEXT REFERENCES users(id),
  entered_at TEXT
);
