CREATE TABLE venues (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  address TEXT NOT NULL DEFAULT '',
  contact_name TEXT NOT NULL DEFAULT '',
  contact_phone TEXT NOT NULL DEFAULT '',
  contact_email TEXT NOT NULL DEFAULT '',
  access_instructions TEXT NOT NULL DEFAULT '',
  cost_per_hour REAL,
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE venue_timeslots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  day_of_week TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE venue_access (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  access_type TEXT NOT NULL DEFAULT 'key',
  notes TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(venue_id, user_id)
);

CREATE TABLE venue_documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  venue_id TEXT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
  document_name TEXT NOT NULL,
  document_url TEXT NOT NULL,
  uploaded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE team_timeslot_assignments (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  timeslot_id TEXT NOT NULL REFERENCES venue_timeslots(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(team_id, timeslot_id)
);
