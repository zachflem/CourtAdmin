-- Rename 'general' sponsor tier to 'supporter'
UPDATE sponsors SET tier = 'supporter' WHERE tier = 'general';
