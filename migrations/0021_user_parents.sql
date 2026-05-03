-- Links parent/guardian user accounts to their child player accounts.
-- Populated when an EOI for a minor is approved.
CREATE TABLE IF NOT EXISTS user_parents (
  parent_user_id TEXT NOT NULL,
  child_user_id  TEXT NOT NULL,
  relationship   TEXT,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (parent_user_id, child_user_id),
  FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (child_user_id)  REFERENCES users(id) ON DELETE CASCADE
);
