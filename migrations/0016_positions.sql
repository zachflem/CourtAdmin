CREATE TABLE club_positions (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL UNIQUE,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE user_positions (
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  position_id TEXT NOT NULL REFERENCES club_positions(id) ON DELETE CASCADE,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, position_id)
);
