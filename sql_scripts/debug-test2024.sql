-- Comprehensive debugging for TEST2024 user and maintenance categories

-- 1. Check the TEST2024 user's profile and Facebook ID
SELECT '=== TEST2024 Profile ===' as section;
SELECT 
    p.id as profile_id,
    p.full_name,
    p.chat_platform_id as facebook_id,
    p.unit_id,
    p.is_manager,
    p.created_at,
    p.updated_at
FROM profiles p
WHERE p.full_name = 'Test User' 
   OR p.id IN (SELECT id FROM profiles WHERE chat_platform_id IS NOT NULL ORDER BY updated_at DESC LIMIT 5);

-- 2. Check the invite details
SELECT '=== TEST2024 Invite ===' as section;
SELECT 
    i.id as invite_id,
    i.login_code,
    i.status,
    i.email,
    i.full_name,
    i.unit_id,
    i.building_id,
    i.expires_at,
    i.created_at
FROM invites i
WHERE i.login_code = 'TEST2024';

-- 3. Check unit and building relationship
SELECT '=== Unit and Building for TEST2024 ===' as section;
SELECT 
    u.id as unit_id,
    u.unit_number,
    u.building_id,
    b.id as building_id_from_join,
    b.name as building_name
FROM profiles p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE p.full_name = 'Test User';

-- 4. Check ALL maintenance categories
SELECT '=== ALL Maintenance Categories ===' as section;
SELECT 
    mc.id,
    mc.name,
    mc.building_id,
    mc.is_active,
    b.name as building_name
FROM maintenance_categories mc
LEFT JOIN buildings b ON mc.building_id = b.id
ORDER BY mc.is_active DESC, mc.building_id NULLS FIRST, mc.name;

-- 5. Check what categories TEST2024 user SHOULD see (based on building or global)
SELECT '=== Categories TEST2024 Should See ===' as section;
WITH user_building AS (
    SELECT 
        p.id as profile_id,
        p.full_name,
        u.building_id
    FROM profiles p
    LEFT JOIN units u ON p.unit_id = u.id
    WHERE p.full_name = 'Test User'
)
SELECT 
    mc.id,
    mc.name,
    mc.is_active,
    CASE 
        WHEN mc.building_id IS NULL THEN 'Global'
        WHEN mc.building_id = ub.building_id THEN 'Building-specific'
        ELSE 'Different building'
    END as category_type,
    mc.building_id,
    ub.building_id as user_building_id
FROM maintenance_categories mc
CROSS JOIN user_building ub
WHERE mc.is_active = true
  AND (mc.building_id IS NULL OR mc.building_id = ub.building_id)
ORDER BY mc.name;

-- 6. Check if there's a profile with a recent Facebook ID
SELECT '=== Recent Facebook Connections ===' as section;
SELECT 
    p.id,
    p.full_name,
    p.chat_platform_id,
    p.unit_id,
    p.updated_at,
    u.unit_number,
    b.name as building_name
FROM profiles p
LEFT JOIN units u ON p.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE p.chat_platform_id IS NOT NULL
ORDER BY p.updated_at DESC
LIMIT 5;

-- 7. Count summary
SELECT '=== Summary ===' as section;
SELECT 
    (SELECT COUNT(*) FROM maintenance_categories WHERE is_active = true) as active_categories,
    (SELECT COUNT(*) FROM maintenance_categories WHERE is_active = true AND building_id IS NULL) as global_categories,
    (SELECT COUNT(*) FROM profiles WHERE full_name = 'Test User') as test_user_profiles,
    (SELECT COUNT(*) FROM profiles WHERE full_name = 'Test User' AND unit_id IS NOT NULL) as test_user_with_unit,
    (SELECT COUNT(*) FROM profiles WHERE full_name = 'Test User' AND chat_platform_id IS NOT NULL) as test_user_with_facebook;
