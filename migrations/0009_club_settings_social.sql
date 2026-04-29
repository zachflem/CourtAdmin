-- Migration 0009: Add social media fields to club_settings
ALTER TABLE club_settings ADD COLUMN social_facebook TEXT;
ALTER TABLE club_settings ADD COLUMN social_instagram TEXT;
ALTER TABLE club_settings ADD COLUMN social_twitter TEXT;
ALTER TABLE club_settings ADD COLUMN social_tiktok TEXT;
