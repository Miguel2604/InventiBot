-- Disable RLS on user_ha_config table to allow access via anon key
-- Note: Security is handled at application level by filtering with user_id
ALTER TABLE user_ha_config DISABLE ROW LEVEL SECURITY;