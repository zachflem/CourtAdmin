-- Add division to teams (nullable; existing rows get NULL until edited)
ALTER TABLE teams ADD COLUMN division TEXT;
