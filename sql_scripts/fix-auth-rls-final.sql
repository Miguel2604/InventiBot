-- COMPLETE FIX FOR AUTHENTICATION AND RLS POLICIES
-- Run this in your Supabase SQL Editor
-- This script will fix the infinite recursion issue and ensure proper authentication

-- 1. First, let's check what tables actually exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN ('profiles', 'user_profiles');

-- 2. Drop all existing policies to start fresh (avoiding conflicts)
DO $$ 
BEGIN
    -- Drop policies on profiles if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'profiles' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Allow service role full access" ON public.profiles;
        DROP POLICY IF EXISTS "Allow anon access for auth" ON public.profiles;
        DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
    END IF;
    
    -- Drop policies on user_profiles if it exists
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        DROP POLICY IF EXISTS "Allow service role full access" ON public.user_profiles;
        DROP POLICY IF EXISTS "Allow anon read for auth" ON public.user_profiles;
        DROP POLICY IF EXISTS "Users can view own profile" ON public.user_profiles;
        DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
    END IF;
END $$;

-- Drop other related policies
DROP POLICY IF EXISTS "Allow service role full access" ON public.invites;
DROP POLICY IF EXISTS "Allow anon read for auth" ON public.invites;
DROP POLICY IF EXISTS "Allow anon update invite status" ON public.invites;
DROP POLICY IF EXISTS "Allow service role full access" ON public.buildings;
DROP POLICY IF EXISTS "Allow anon read for auth" ON public.buildings;
DROP POLICY IF EXISTS "Allow service role full access" ON public.units;
DROP POLICY IF EXISTS "Allow anon read for auth" ON public.units;

-- 3. Create/ensure profiles table exists (this is what the auth service uses)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_platform_id VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    unit_id UUID REFERENCES units(id),
    is_manager BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add phone_number column if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_schema = 'public' 
                   AND table_name = 'profiles' 
                   AND column_name = 'phone_number') THEN
        ALTER TABLE public.profiles ADD COLUMN phone_number VARCHAR(20);
    END IF;
END $$;

-- 4. Migrate data from user_profiles to profiles if needed
DO $$
DECLARE
    has_phone_column BOOLEAN;
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        -- Check if user_profiles has phone_number column
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'user_profiles' 
            AND column_name = 'phone_number'
        ) INTO has_phone_column;
        
        IF has_phone_column THEN
            -- Insert with phone_number if it exists
            INSERT INTO public.profiles (id, full_name, unit_id, is_manager, phone_number, created_at, updated_at)
            SELECT 
                COALESCE(up.id, uuid_generate_v4()),
                up.full_name,
                up.unit_id,
                COALESCE(up.is_manager, false),
                up.phone_number,
                COALESCE(up.created_at, NOW()),
                COALESCE(up.updated_at, NOW())
            FROM public.user_profiles up
            WHERE NOT EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = up.id
            );
        ELSE
            -- Insert without phone_number if it doesn't exist
            INSERT INTO public.profiles (id, full_name, unit_id, is_manager, created_at, updated_at)
            SELECT 
                COALESCE(up.id, uuid_generate_v4()),
                up.full_name,
                up.unit_id,
                COALESCE(up.is_manager, false),
                COALESCE(up.created_at, NOW()),
                COALESCE(up.updated_at, NOW())
            FROM public.user_profiles up
            WHERE NOT EXISTS (
                SELECT 1 FROM public.profiles p WHERE p.id = up.id
            );
        END IF;
    END IF;
END $$;

-- 5. Enable RLS on all relevant tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;

-- Also handle user_profiles if it exists
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 6. Create simple, non-recursive policies for profiles table
-- Service role has full access
CREATE POLICY "service_role_all_access_profiles" ON public.profiles
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

-- Anon can read and write profiles (needed for authentication flow)
CREATE POLICY "anon_all_access_profiles" ON public.profiles
    FOR ALL 
    TO anon
    USING (true)
    WITH CHECK (true);

-- 7. Create policies for invites table
CREATE POLICY "service_role_all_access_invites" ON public.invites
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "anon_read_invites" ON public.invites
    FOR SELECT 
    TO anon
    USING (true);

CREATE POLICY "anon_update_invites" ON public.invites
    FOR UPDATE 
    TO anon
    USING (true)
    WITH CHECK (status IN ('claimed', 'expired', 'revoked', 'pending', 'completed'));

-- 8. Create policies for buildings and units (read-only for anon)
CREATE POLICY "service_role_all_access_buildings" ON public.buildings
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "anon_read_buildings" ON public.buildings
    FOR SELECT 
    TO anon
    USING (true);

CREATE POLICY "service_role_all_access_units" ON public.units
    FOR ALL 
    TO service_role
    USING (true)
    WITH CHECK (true);

CREATE POLICY "anon_read_units" ON public.units
    FOR SELECT 
    TO anon
    USING (true);

-- 9. If user_profiles exists, add simple policies to prevent recursion
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles' AND table_schema = 'public') THEN
        -- Service role has full access
        EXECUTE 'CREATE POLICY "service_role_all_access_user_profiles" ON public.user_profiles
            FOR ALL 
            TO service_role
            USING (true)
            WITH CHECK (true)';
        
        -- Anon can read all (needed for authentication checks)
        EXECUTE 'CREATE POLICY "anon_read_user_profiles" ON public.user_profiles
            FOR SELECT 
            TO anon
            USING (true)';
    END IF;
END $$;

-- 10. Verify the policies were created correctly
SELECT 
    schemaname,
    tablename, 
    policyname, 
    roles,
    cmd,
    permissive
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('profiles', 'user_profiles', 'invites', 'buildings', 'units')
ORDER BY tablename, policyname;

-- 11. Create or refresh a test invite for testing
-- First check if TEST2024 exists
DO $$
DECLARE
    test_unit_id UUID;
BEGIN
    -- Get a unit ID (prefer unit 101 if it exists)
    SELECT id INTO test_unit_id 
    FROM units 
    WHERE unit_number = '101' 
    LIMIT 1;
    
    -- If no unit 101, get any unit
    IF test_unit_id IS NULL THEN
        SELECT id INTO test_unit_id 
        FROM units 
        LIMIT 1;
    END IF;
    
    -- Update or insert the test invite
    INSERT INTO invites (
        unit_id,
        full_name,
        login_code,
        status,
        expires_at
    ) VALUES (
        test_unit_id,
        'Test User',
        'TEST2024',
        'pending',
        NOW() + INTERVAL '30 days'
    )
    ON CONFLICT (login_code) 
    DO UPDATE SET 
        status = 'pending',
        expires_at = NOW() + INTERVAL '30 days',
        updated_at = NOW();
    
    RAISE NOTICE 'Test invite code TEST2024 is ready for unit_id: %', test_unit_id;
END $$;

-- 12. Show available invites for testing
SELECT 
    i.login_code,
    i.status,
    i.full_name,
    i.expires_at,
    u.unit_number,
    b.name as building_name
FROM invites i
LEFT JOIN units u ON i.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE i.status = 'pending'
  AND i.expires_at > NOW()
ORDER BY i.created_at DESC;

-- 13. Test the connection by counting records
SELECT 
    'invites' as table_name,
    COUNT(*) as record_count
FROM invites
UNION ALL
SELECT 
    'profiles' as table_name,
    COUNT(*) as record_count
FROM profiles
UNION ALL
SELECT 
    'units' as table_name,
    COUNT(*) as record_count
FROM units
UNION ALL
SELECT 
    'buildings' as table_name,
    COUNT(*) as record_count
FROM buildings;
