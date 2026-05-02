-- Add court name/number to venue timeslots for multi-court venues
ALTER TABLE venue_timeslots ADD COLUMN court_name TEXT NOT NULL DEFAULT '';
