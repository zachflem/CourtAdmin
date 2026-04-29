CREATE TABLE contact_messages (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  enquiry_type TEXT NOT NULL DEFAULT 'General Enquiry',
  message TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

ALTER TABLE club_settings ADD COLUMN contact_enquiry_types TEXT NOT NULL DEFAULT '[{"label":"General Enquiry","forward_to":""},{"label":"Membership / Registration","forward_to":""},{"label":"Coaching / Volunteering","forward_to":""}]';
