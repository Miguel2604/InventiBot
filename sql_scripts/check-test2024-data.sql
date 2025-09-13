-- Check TEST2024 user profile and related data

-- 1. Check user profile with invite code TEST2024
SELECT 
    'User Profile for TEST2024' as query_type,
    up.*,
    i.login_code,
    i.status as invite_status
FROM user_profiles up
LEFT JOIN invites i ON i.email = up.email
WHERE i.login_code = 'TEST2024' OR up.full_name = 'Test User';

-- 2. Check the unit and building for this user
SELECT 
    'Unit and Building Info' as query_type,
    up.id as profile_id,
    up.full_name,
    up.unit_id,
    u.unit_number,
    u.building_id,
    b.name as building_name
FROM user_profiles up
LEFT JOIN units u ON up.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
LEFT JOIN invites i ON i.email = up.email
WHERE i.login_code = 'TEST2024' OR up.full_name = 'Test User';

-- 3. Check all maintenance categories (global and building-specific)
SELECT 
    'All Maintenance Categories' as query_type,
    mc.*,
    CASE 
        WHEN mc.building_id IS NULL THEN 'Global'
        ELSE b.name
    END as scope
FROM maintenance_categories mc
LEFT JOIN buildings b ON mc.building_id = b.id
WHERE mc.is_active = true
ORDER BY mc.building_id NULLS FIRST, mc.name;

-- 4. Check what building_id the TEST2024 user has
SELECT 
    'TEST2024 Building ID' as query_type,
    b.id as building_id,
    b.name as building_name
FROM user_profiles up
JOIN units u ON up.unit_id = u.id
JOIN buildings b ON u.building_id = b.id
LEFT JOIN invites i ON i.email = up.email
WHERE i.login_code = 'TEST2024' OR up.full_name = 'Test User';
