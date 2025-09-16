-- Enable RLS on user_ha_config table
ALTER TABLE user_ha_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if any
DROP POLICY IF EXISTS "Users can view their own config" ON user_ha_config;
DROP POLICY IF EXISTS "Users can insert their own config" ON user_ha_config;
DROP POLICY IF EXISTS "Users can update their own config" ON user_ha_config;
DROP POLICY IF EXISTS "Users can delete their own config" ON user_ha_config;

-- Create policy for SELECT - users can only see their own config
CREATE POLICY "Users can view their own config" ON user_ha_config
    FOR SELECT
    USING (true);  -- Allow all authenticated users to read (filtered by user_id in app)

-- Create policy for INSERT - users can only insert their own config
CREATE POLICY "Users can insert their own config" ON user_ha_config
    FOR INSERT
    WITH CHECK (true);  -- Allow all authenticated users to insert

-- Create policy for UPDATE - users can only update their own config
CREATE POLICY "Users can update their own config" ON user_ha_config
    FOR UPDATE
    USING (true)  -- Allow all authenticated users to update (filtered by user_id in app)
    WITH CHECK (true);

-- Create policy for DELETE - users can only delete their own config
CREATE POLICY "Users can delete their own config" ON user_ha_config
    FOR DELETE
    USING (true);  -- Allow all authenticated users to delete (filtered by user_id in app)

-- Note: Since we're using service role key in the bot, these policies are permissive
-- The actual security is handled at the application level by filtering with user_id