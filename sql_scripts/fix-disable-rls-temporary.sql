-- TEMPORARY FIX: DISABLE RLS TO TEST THE APPLICATION
-- ⚠️ WARNING: This removes all Row Level Security - use only for testing!
-- Run this in your Supabase SQL Editor to immediately fix the permission issues

-- =====================================================
-- STEP 1: Grant all permissions
-- =====================================================
GRANT USAGE ON SCHEMA public TO service_role, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO service_role, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO service_role, anon, authenticated;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO service_role, anon, authenticated;

-- =====================================================
-- STEP 2: Disable RLS on all tables
-- =====================================================
DO $$
DECLARE
    r RECORD;
BEGIN
    -- Disable RLS on all tables in public schema
    FOR r IN 
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', r.tablename);
        RAISE NOTICE 'Disabled RLS on table: %', r.tablename;
    END LOOP;
END $$;

-- =====================================================
-- STEP 3: Ensure profiles table exists with correct structure
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
-- STEP 4: Create/refresh test invite
-- =====================================================
DO $$
DECLARE
    test_unit_id UUID;
    test_building_id UUID;
BEGIN
    -- Get or create a building
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
    
    -- Delete old TEST2024 invite if exists
    DELETE FROM invites WHERE login_code = 'TEST2024';
    
    -- Create new test invite
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
        uuid_generate_v4()
    );
    
    RAISE NOTICE 'Test invite TEST2024 created successfully';
END $$;

-- =====================================================
-- STEP 5: Verify the fix
-- =====================================================

-- Check RLS status (should all be false)
SELECT 
    schemaname,
    tablename,
    rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;

-- Test queries
SELECT COUNT(*) as profile_count FROM public.profiles;
SELECT COUNT(*) as invite_count FROM public.invites WHERE status = 'pending';

-- Show test invite
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
WHERE i.login_code = 'TEST2024';

-- Final status
SELECT 
    '⚠️ RLS DISABLED - App should work now!' as status,
    'Remember to re-enable RLS for production!' as warning,
    current_timestamp as completed_at;
