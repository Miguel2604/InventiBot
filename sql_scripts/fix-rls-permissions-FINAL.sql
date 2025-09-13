-- COMPLETE FIX FOR RLS PERMISSIONS (FINAL VERSION)
-- This script ensures the service role has proper access to all tables
-- Run this in your Supabase SQL Editor

-- =====================================================
-- STEP 1: Verify current user and permissions
-- =====================================================
SELECT current_user, current_role;

-- Check if we're running as postgres/superuser
SELECT 
    rolname,
    rolsuper,
    rolinherit,
    rolcreaterole,
    rolcreatedb,
    rolcanlogin,
    rolreplication,
    rolbypassrls
FROM pg_roles 
WHERE rolname IN ('postgres', 'authenticator', 'service_role', 'anon');

-- =====================================================
-- STEP 2: Grant proper schema permissions
-- =====================================================
-- Grant usage on the public schema
GRANT USAGE ON SCHEMA public TO service_role;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant all privileges on all tables in public schema to service_role
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role;

-- Grant select privileges to anon (for authentication checks)
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
GRANT UPDATE ON public.profiles TO anon;
GRANT INSERT ON public.profiles TO anon;
GRANT UPDATE ON public.invites TO anon;

-- Grant privileges to authenticated role as well
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- =====================================================
-- STEP 3: Ensure service_role bypasses RLS
-- =====================================================
-- Service role should bypass RLS by default, but let's make sure
ALTER ROLE service_role SET row_security TO OFF;

-- =====================================================
-- STEP 4: Drop all existing RLS policies (clean slate)
-- =====================================================
DO $$ 
DECLARE
    pol record;
BEGIN
    -- Drop all policies on profiles
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'profiles'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
    END LOOP;
    
    -- Drop all policies on invites
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'invites'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.invites', pol.policyname);
    END LOOP;
    
    -- Drop all policies on buildings
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'buildings'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.buildings', pol.policyname);
    END LOOP;
    
    -- Drop all policies on units
    FOR pol IN 
        SELECT policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' AND tablename = 'units'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON public.units', pol.policyname);
    END LOOP;
    
    -- Drop all policies on user_profiles if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        FOR pol IN 
            SELECT policyname 
            FROM pg_policies 
            WHERE schemaname = 'public' AND tablename = 'user_profiles'
        LOOP
            EXECUTE format('DROP POLICY IF EXISTS %I ON public.user_profiles', pol.policyname);
        END LOOP;
    END IF;
END $$;

-- =====================================================
-- STEP 5: Disable RLS temporarily to ensure access
-- =====================================================
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.units DISABLE ROW LEVEL SECURITY;

-- Disable on user_profiles if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        ALTER TABLE public.user_profiles DISABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- =====================================================
-- STEP 6: Ensure profiles table exists with correct structure
-- =====================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_platform_id VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    unit_id UUID REFERENCES units(id),
    is_manager BOOLEAN DEFAULT false,
    phone_number VARCHAR(20),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add missing columns if they don't exist
DO $$
BEGIN
    -- Add chat_platform_id if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'chat_platform_id') THEN
        ALTER TABLE public.profiles ADD COLUMN chat_platform_id VARCHAR(255) UNIQUE;
    END IF;
    
    -- Add phone_number if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'phone_number') THEN
        ALTER TABLE public.profiles ADD COLUMN phone_number VARCHAR(20);
    END IF;
    
    -- Add is_manager if missing
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'is_manager') THEN
        ALTER TABLE public.profiles ADD COLUMN is_manager BOOLEAN DEFAULT false;
    END IF;
END $$;

-- =====================================================
-- STEP 7: Re-enable RLS with proper policies
-- =====================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- STEP 8: Create simple, permissive policies
-- =====================================================

-- PROFILES table policies
-- Service role bypasses RLS, so no policy needed for service_role
-- Anon can do everything (needed for authentication flow)
CREATE POLICY "anon_full_access_profiles" ON public.profiles
    FOR ALL 
    TO anon
    USING (true)
    WITH CHECK (true);

-- Authenticated users can do everything
CREATE POLICY "authenticated_full_access_profiles" ON public.profiles
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- INVITES table policies
CREATE POLICY "anon_full_access_invites" ON public.invites
    FOR ALL 
    TO anon
    USING (true)
    WITH CHECK (true);

CREATE POLICY "authenticated_full_access_invites" ON public.invites
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- BUILDINGS table policies
CREATE POLICY "anon_read_buildings" ON public.buildings
    FOR SELECT 
    TO anon
    USING (true);

CREATE POLICY "authenticated_full_access_buildings" ON public.buildings
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- UNITS table policies
CREATE POLICY "anon_read_units" ON public.units
    FOR SELECT 
    TO anon
    USING (true);

CREATE POLICY "authenticated_full_access_units" ON public.units
    FOR ALL 
    TO authenticated
    USING (true)
    WITH CHECK (true);

-- =====================================================
-- STEP 9: Handle user_profiles table if it exists
-- =====================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        -- Enable RLS
        ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        EXECUTE 'CREATE POLICY "anon_read_user_profiles" ON public.user_profiles
            FOR SELECT 
            TO anon
            USING (true)';
            
        EXECUTE 'CREATE POLICY "authenticated_full_access_user_profiles" ON public.user_profiles
            FOR ALL 
            TO authenticated
            USING (true)
            WITH CHECK (true)';
    END IF;
END $$;

-- =====================================================
-- STEP 10: Set default privileges for future tables
-- =====================================================
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated;

-- =====================================================
-- STEP 11: Create admin user for invites if needed
-- =====================================================
DO $$
DECLARE
    admin_user_id UUID;
    test_building_id UUID;
BEGIN
    -- Get or create a building first
    SELECT id INTO test_building_id FROM buildings LIMIT 1;
    
    IF test_building_id IS NULL THEN
        INSERT INTO buildings (name, address, city, state, zip_code)
        VALUES ('Test Building', '123 Test St', 'Test City', 'TS', '12345')
        RETURNING id INTO test_building_id;
    END IF;
    
    -- Check if any admin user exists in user_profiles
    SELECT id INTO admin_user_id 
    FROM user_profiles 
    WHERE role IN ('admin', 'super_admin') 
    LIMIT 1;
    
    -- If no admin exists, create a system admin user
    IF admin_user_id IS NULL THEN
        -- Generate a new UUID for the admin
        admin_user_id := uuid_generate_v4();
        
        -- Create a system admin user in user_profiles
        INSERT INTO user_profiles (
            id,
            email,
            full_name,
            role,
            building_id,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            admin_user_id,
            'system@inventibot.com',
            'System Admin',
            'super_admin',
            test_building_id,
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE 'Created system admin user with ID: %', admin_user_id;
    ELSE
        RAISE NOTICE 'Using existing admin user with ID: %', admin_user_id;
    END IF;
END $$;

-- =====================================================
-- STEP 12: Create/refresh test invite
-- =====================================================
DO $$
DECLARE
    test_unit_id UUID;
    test_building_id UUID;
    admin_user_id UUID;
BEGIN
    -- Get a building
    SELECT id INTO test_building_id FROM buildings LIMIT 1;
    
    IF test_building_id IS NULL THEN
        INSERT INTO buildings (name, address, city, state, zip_code)
        VALUES ('Test Building', '123 Test St', 'Test City', 'TS', '12345')
        RETURNING id INTO test_building_id;
    END IF;
    
    -- Get or create a unit
    SELECT id INTO test_unit_id FROM units WHERE building_id = test_building_id LIMIT 1;
    
    IF test_unit_id IS NULL THEN
        INSERT INTO units (building_id, unit_number, floor, bedrooms, bathrooms)
        VALUES (test_building_id, '101', 1, 2, 1.0)
        RETURNING id INTO test_unit_id;
    END IF;
    
    -- Get the admin user we created or found
    SELECT id INTO admin_user_id 
    FROM user_profiles 
    WHERE role IN ('admin', 'super_admin') 
    LIMIT 1;
    
    IF admin_user_id IS NULL THEN
        RAISE EXCEPTION 'No admin user found to create invite';
    END IF;
    
    -- Delete old TEST2024 invite if exists
    DELETE FROM invites WHERE login_code = 'TEST2024';
    
    -- Create new test invite with valid created_by reference
    INSERT INTO invites (
        building_id,
        unit_id,
        full_name,
        login_code,
        status,
        expires_at,
        created_by
    ) VALUES (
        test_building_id,
        test_unit_id,
        'Test User',
        'TEST2024',
        'pending',
        NOW() + INTERVAL '30 days',
        admin_user_id  -- Use the actual admin user ID
    );
    
    RAISE NOTICE 'Test invite TEST2024 created successfully';
    RAISE NOTICE 'Building ID: %', test_building_id;
    RAISE NOTICE 'Unit ID: %', test_unit_id;
    RAISE NOTICE 'Created by admin: %', admin_user_id;
END $$;

-- =====================================================
-- STEP 13: Verify the fix
-- =====================================================

-- Check table permissions (FIXED column names)
SELECT 
    table_schema,
    table_name,
    privilege_type,
    grantee
FROM information_schema.table_privileges
WHERE table_schema = 'public' 
    AND table_name IN ('profiles', 'invites', 'buildings', 'units')
    AND grantee IN ('service_role', 'anon', 'authenticated')
ORDER BY table_name, grantee, privilege_type
LIMIT 20;

-- Check RLS status
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN ('profiles', 'invites', 'buildings', 'units', 'user_profiles');

-- Check policies
SELECT 
    schemaname,
    tablename, 
    policyname, 
    roles,
    cmd
FROM pg_policies 
WHERE schemaname = 'public' 
    AND tablename IN ('profiles', 'invites', 'buildings', 'units', 'user_profiles')
ORDER BY tablename, policyname;

-- =====================================================
-- STEP 14: Test with actual queries
-- =====================================================

-- Test as service_role would see it
SET ROLE service_role;
SELECT 'Testing as service_role' as test_role;
SELECT COUNT(*) as profile_count FROM public.profiles;
SELECT COUNT(*) as invite_count FROM public.invites;
RESET ROLE;

-- Test as anon would see it
SET ROLE anon;
SELECT 'Testing as anon' as test_role;
SELECT COUNT(*) as profile_count FROM public.profiles;
SELECT COUNT(*) as invite_count FROM public.invites;
RESET ROLE;

-- =====================================================
-- STEP 15: Show the test invite
-- =====================================================
SELECT 
    i.login_code,
    i.status,
    i.full_name,
    i.expires_at,
    u.unit_number,
    b.name as building_name,
    up.full_name as created_by_name
FROM invites i
LEFT JOIN units u ON i.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
LEFT JOIN user_profiles up ON i.created_by = up.id
WHERE i.login_code = 'TEST2024';

-- =====================================================
-- STEP 16: Final summary
-- =====================================================
SELECT 
    'Fix completed successfully!' as status,
    current_timestamp as completed_at,
    (SELECT COUNT(*) FROM profiles) as total_profiles,
    (SELECT COUNT(*) FROM user_profiles) as total_user_profiles,
    (SELECT COUNT(*) FROM invites WHERE status = 'pending') as pending_invites,
    (SELECT COUNT(*) FROM pg_policies WHERE schemaname = 'public') as total_policies;
