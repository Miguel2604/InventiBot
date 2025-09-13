-- Complete cleanup of user_profiles table
-- This script safely migrates any remaining data and removes the old table

-- Step 1: First apply the foreign key fixes (if not already done)
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_tenant_id_fkey;

ALTER TABLE bookings 
ADD CONSTRAINT bookings_tenant_id_fkey 
FOREIGN KEY (tenant_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

ALTER TABLE maintenance_requests 
DROP CONSTRAINT IF EXISTS maintenance_requests_tenant_id_fkey;

ALTER TABLE maintenance_requests 
ADD CONSTRAINT maintenance_requests_tenant_id_fkey 
FOREIGN KEY (tenant_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Step 2: Check what data exists in user_profiles
SELECT 'Data in user_profiles:' as info;
SELECT id, full_name, unit_id, created_at FROM user_profiles;

-- Step 3: Check if this data already exists in profiles
SELECT 'Corresponding data in profiles:' as info;
SELECT p.id, p.full_name, p.unit_id, p.chat_platform_id 
FROM profiles p
WHERE p.id IN (SELECT id FROM user_profiles);

-- Step 4: Migrate any missing data from user_profiles to profiles
-- Only insert if the ID doesn't already exist in profiles
INSERT INTO profiles (id, full_name, unit_id, is_manager, updated_at)
SELECT 
    up.id,
    up.full_name,
    up.unit_id,
    false as is_manager,
    NOW() as updated_at
FROM user_profiles up
WHERE NOT EXISTS (
    SELECT 1 FROM profiles p WHERE p.id = up.id
)
ON CONFLICT (id) DO NOTHING;

-- Step 5: Show final state
SELECT 'Final profiles count:' as info;
SELECT COUNT(*) as profile_count FROM profiles;

-- Step 6: Check for any remaining foreign key dependencies
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND ccu.table_name = 'user_profiles';

-- Step 7: Drop the user_profiles table
-- CASCADE will remove any remaining dependencies
DROP TABLE IF EXISTS user_profiles CASCADE;

-- Step 8: Confirm deletion
SELECT 'Cleanup complete. Tables in public schema:' as info;
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
    AND table_type = 'BASE TABLE'
    AND table_name LIKE '%profile%'
ORDER BY table_name;
