-- =====================================================
-- FIX TABLE PERMISSIONS FOR CHATBOT OPERATIONS
-- =====================================================
-- This script ensures proper permissions for the chatbot
-- to claim invites and create/update profiles

-- Grant necessary permissions to authenticated and anon roles
-- Note: The service role (used by supabaseAdmin) already has full access

-- For the invites table
GRANT SELECT ON invites TO anon, authenticated;
GRANT UPDATE (status, claimed_at, claimed_by, updated_at) ON invites TO authenticated;

-- For the profiles table
GRANT SELECT, INSERT, UPDATE ON profiles TO authenticated;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- For the units table (needed for foreign key references and joins)
GRANT SELECT ON units TO anon, authenticated;
GRANT UPDATE (is_occupied, updated_at) ON units TO authenticated;

-- For the buildings table (needed for joins)
GRANT SELECT ON buildings TO anon, authenticated;

-- Ensure RLS policies allow the operations we need
-- Note: These might already exist, so we use CREATE OR REPLACE where possible

-- Drop existing policies if they exist (to recreate them)
DROP POLICY IF EXISTS "Invites readable by anyone with code" ON invites;
DROP POLICY IF EXISTS "Profiles readable by authenticated users" ON profiles;
DROP POLICY IF EXISTS "Profiles insertable by service role" ON profiles;
DROP POLICY IF EXISTS "Units readable by authenticated users" ON units;
DROP POLICY IF EXISTS "Buildings readable by authenticated users" ON buildings;

-- Create policies for invites
CREATE POLICY "Invites readable by anyone with code" ON invites
    FOR SELECT
    USING (true);  -- Anyone can check if an invite code exists

-- Create policies for profiles
CREATE POLICY "Profiles readable by authenticated users" ON profiles
    FOR SELECT
    USING (true);  -- Authenticated users can read profiles

CREATE POLICY "Profiles manageable by service role" ON profiles
    FOR ALL
    USING (true)  -- Service role can do anything
    WITH CHECK (true);

-- Create policies for units
CREATE POLICY "Units readable by authenticated users" ON units
    FOR SELECT
    USING (true);  -- Anyone can read unit information

CREATE POLICY "Units updatable by service role" ON units
    FOR UPDATE
    USING (true)
    WITH CHECK (true);

-- Create policies for buildings
CREATE POLICY "Buildings readable by authenticated users" ON buildings
    FOR SELECT
    USING (true);  -- Anyone can read building information

-- Verify the permissions
SELECT 
    schemaname,
    tablename,
    has_table_privilege('anon', schemaname||'.'||tablename, 'SELECT') as anon_select,
    has_table_privilege('authenticated', schemaname||'.'||tablename, 'SELECT') as auth_select,
    has_table_privilege('authenticated', schemaname||'.'||tablename, 'INSERT') as auth_insert,
    has_table_privilege('authenticated', schemaname||'.'||tablename, 'UPDATE') as auth_update
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('invites', 'profiles', 'units', 'buildings')
ORDER BY tablename;

-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('invites', 'profiles', 'units', 'buildings');

-- List all policies on our tables
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies
WHERE schemaname = 'public'
    AND tablename IN ('invites', 'profiles', 'units', 'buildings')
ORDER BY tablename, policyname;