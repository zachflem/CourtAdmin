-- Add configurable divisions list to club_settings
ALTER TABLE club_settings ADD COLUMN divisions TEXT DEFAULT '["Div 1","Div 2","Div 3"]';
