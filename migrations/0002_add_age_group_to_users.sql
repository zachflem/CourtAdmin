-- Migration 0002: Add age_group column to users (set at EOI approval time)
ALTER TABLE users ADD COLUMN age_group TEXT;
