-- Create invite for your single user: 0bb3a1a6-5f90-4d0f-ac2f-931537245261
-- Run this in your Supabase SQL Editor

-- First, create the user profile in user_profiles table
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
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    building_id = EXCLUDED.building_id,
    unit_id = EXCLUDED.unit_id;

-- Create the invite with access code
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
    'USERCODE', -- Simple access code for you
    'pending',
    '0bb3a1a6-5f90-4d0f-ac2f-931537245261', -- Your user ID
    NOW() + INTERVAL '7 days'
)
ON CONFLICT (login_code) DO UPDATE SET
    status = 'pending',
    expires_at = NOW() + INTERVAL '7 days';

-- Show the created invite
SELECT 
    i.login_code as "🔑 YOUR ACCESS CODE",
    i.email as "📧 Email",
    i.full_name as "👤 Name", 
    b.name as "🏢 Building",
    u.unit_number as "🏠 Unit",
    i.status as "Status",
    i.expires_at as "⏰ Expires"
FROM invites i
JOIN buildings b ON i.building_id = b.id
JOIN units u ON i.unit_id = u.id
WHERE i.created_by = '0bb3a1a6-5f90-4d0f-ac2f-931537245261'
ORDER BY i.created_at DESC;
