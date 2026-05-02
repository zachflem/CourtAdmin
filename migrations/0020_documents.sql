CREATE TABLE documents (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  file_url TEXT NOT NULL,
  file_name TEXT NOT NULL,
  requires_acknowledgement INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 0,
  version TEXT NOT NULL DEFAULT '1.0',
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE document_acknowledgements (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  acknowledged_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(document_id, user_id)
);
