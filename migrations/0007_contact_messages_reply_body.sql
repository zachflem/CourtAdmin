ALTER TABLE contact_messages ADD COLUMN reply_subject TEXT;
ALTER TABLE contact_messages ADD COLUMN reply_message TEXT;
ALTER TABLE contact_messages ADD COLUMN replied_by_user_id TEXT REFERENCES users(id);
