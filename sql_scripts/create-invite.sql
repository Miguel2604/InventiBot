-- Create invite for your tenant
-- Run this in your Supabase SQL Editor

-- First, let's create the user profile if it doesn't exist
INSERT INTO user_profiles (id, email, full_name, role, building_id, unit_id, is_active)
VALUES (
    '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    'user@user.com', 
    'Test User',
    'tenant',
    '11111111-1111-1111-1111-111111111111', -- Sunset Tower from seed data
    'a4444444-4444-4444-4444-444444444444', -- Unit 202 (vacant) from seed data
    true
)
ON CONFLICT (id) DO NOTHING; -- Don't overwrite if exists

-- Now create the invite with access code
INSERT INTO invites (
    building_id,
    unit_id, 
    full_name,
    email,
    login_code,
    status,
    created_by,
    expires_at
) VALUES (
    '11111111-1111-1111-1111-111111111111', -- Sunset Tower
    'a4444444-4444-4444-4444-444444444444', -- Unit 202
    'Test User',
    'user@user.com',
    'TESTCODE', -- Your access code
    'pending',
    '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    NOW() + INTERVAL '7 days'
);

-- Create some additional test codes
INSERT INTO invites (
    building_id,
    unit_id, 
    full_name,
    email,
    login_code,
    status,
    created_by,
    expires_at
) VALUES 
(
    '11111111-1111-1111-1111-111111111111',
    'a6666666-6666-6666-6666-666666666666', -- Unit 302 (vacant)
    'Demo User',
    'demo@example.com',
    'DEMO2024',
    'pending', 
    '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    NOW() + INTERVAL '30 days'
),
(
    '11111111-1111-1111-1111-111111111111',
    'a6666666-6666-6666-6666-666666666666',
    'Test Demo',
    'test@example.com', 
    'TEST123',
    'pending',
    '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    NOW() + INTERVAL '30 days'
)
ON CONFLICT (login_code) DO NOTHING; -- Skip if codes already exist

-- Display the created invites
SELECT 
    i.login_code as "ACCESS CODE",
    i.email,
    i.full_name,
    b.name as building,
    u.unit_number as unit,
    i.status,
    i.expires_at
FROM invites i
JOIN buildings b ON i.building_id = b.id
JOIN units u ON i.unit_id = u.id
WHERE i.email IN ('user@user.com', 'demo@example.com', 'test@example.com')
ORDER BY i.created_at DESC;
