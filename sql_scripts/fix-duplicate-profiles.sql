-- Check for duplicate Test User profiles and fix the issue

-- 1. Show all Test User profiles
SELECT 'All Test User Profiles:' as info;
SELECT 
    p.id,
    p.full_name,
    p.chat_platform_id as facebook_id,
    p.unit_id,
    p.created_at,
    p.updated_at,
    u.unit_number,
    b.name as building_name
FROM profiles p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE p.full_name = 'Test User'
ORDER BY p.updated_at DESC;

-- 2. Show which profile is actually connected (has Facebook ID)
SELECT 'Connected Profile (with Facebook ID):' as info;
SELECT 
    p.id,
    p.full_name,
    p.chat_platform_id as facebook_id,
    p.unit_id,
    u.unit_number,
    u.building_id,
    b.name as building_name
FROM profiles p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE p.full_name = 'Test User' AND p.chat_platform_id IS NOT NULL;

-- 3. Check if the connected profile has proper unit and building
SELECT 'Profile-Unit-Building Chain for Connected User:' as info;
SELECT 
    p.id as profile_id,
    p.chat_platform_id,
    p.unit_id as profile_unit_id,
    u.id as unit_id,
    u.unit_number,
    u.building_id as unit_building_id,
    b.id as building_id,
    b.name as building_name,
    CASE 
        WHEN p.unit_id IS NULL THEN 'Missing unit_id in profile'
        WHEN u.id IS NULL THEN 'Unit not found'
        WHEN u.building_id IS NULL THEN 'Missing building_id in unit'
        WHEN b.id IS NULL THEN 'Building not found'
        ELSE 'All connections OK'
    END as status
FROM profiles p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE p.full_name = 'Test User' AND p.chat_platform_id IS NOT NULL;

-- 4. FIX: Ensure the connected profile has the correct unit
-- First, let's identify which profile needs fixing
WITH connected_profile AS (
    SELECT id, unit_id, chat_platform_id
    FROM profiles 
    WHERE full_name = 'Test User' AND chat_platform_id IS NOT NULL
    LIMIT 1
)
SELECT 
    'Profile to Fix:' as action,
    cp.id as profile_id,
    cp.chat_platform_id,
    cp.unit_id as current_unit_id,
    'a1111111-1111-1111-1111-111111111111' as target_unit_id
FROM connected_profile cp;

-- 5. EXECUTE FIX: Update the connected profile to have the correct unit
UPDATE profiles 
SET unit_id = 'a1111111-1111-1111-1111-111111111111'
WHERE full_name = 'Test User' 
  AND chat_platform_id IS NOT NULL
  AND (unit_id IS NULL OR unit_id != 'a1111111-1111-1111-1111-111111111111');

-- 6. Verify the fix
SELECT 'After Fix - Connected Profile Status:' as info;
SELECT 
    p.id,
    p.full_name,
    p.chat_platform_id as facebook_id,
    p.unit_id,
    u.unit_number,
    u.building_id,
    b.name as building_name,
    COUNT(*) OVER() as total_test_users
FROM profiles p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE p.full_name = 'Test User' AND p.chat_platform_id IS NOT NULL;

-- 7. Show what maintenance categories should be available
SELECT 'Categories Available for Fixed User:' as info;
WITH user_building AS (
    SELECT b.id as building_id
    FROM profiles p
    JOIN units u ON p.unit_id = u.id
    JOIN buildings b ON u.building_id = b.id
    WHERE p.full_name = 'Test User' AND p.chat_platform_id IS NOT NULL
    LIMIT 1
)
SELECT 
    mc.name,
    CASE 
        WHEN mc.building_id IS NULL THEN 'Global (All Buildings)'
        ELSE 'Building-Specific'
    END as scope
FROM maintenance_categories mc
LEFT JOIN user_building ub ON true
WHERE mc.is_active = true
  AND (mc.building_id IS NULL OR mc.building_id = ub.building_id)
ORDER BY mc.name;

-- 8. Optional: Clean up duplicate profiles (only if needed)
-- This will show duplicates but won't delete them automatically
SELECT 'Duplicate Profiles (for manual review):' as info;
SELECT 
    p.id,
    p.full_name,
    p.chat_platform_id,
    p.unit_id,
    p.created_at,
    CASE 
        WHEN p.chat_platform_id IS NOT NULL THEN 'KEEP - Has Facebook connection'
        ELSE 'Consider deleting - No Facebook connection'
    END as recommendation
FROM profiles p
WHERE p.full_name = 'Test User'
ORDER BY (p.chat_platform_id IS NOT NULL) DESC, p.created_at DESC;
