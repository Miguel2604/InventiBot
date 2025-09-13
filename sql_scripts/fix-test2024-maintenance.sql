-- Fix TEST2024 user and ensure maintenance categories are available

-- First, let's check what we have
SELECT 'Current TEST2024 Status:' as info;
SELECT 
    i.login_code,
    i.status as invite_status,
    p.id as profile_id,
    p.full_name,
    p.unit_id,
    u.unit_number,
    u.building_id,
    b.name as building_name
FROM invites i
LEFT JOIN profiles p ON p.chat_platform_id IS NOT NULL AND i.email = 'test@test.com'
LEFT JOIN units u ON p.unit_id = u.id OR i.unit_id = u.id
LEFT JOIN buildings b ON u.building_id = b.id
WHERE i.login_code = 'TEST2024';

-- Create building if it doesn't exist
INSERT INTO buildings (id, name, address, city, state, zip_code, country, phone, email, settings) VALUES
('11111111-1111-1111-1111-111111111111', 'Sunset Tower Apartments', '123 Sunset Boulevard', 'Los Angeles', 'CA', '90028', 'USA', '+1-310-555-0100', 'admin@sunsettower.com', 
    '{"maintenance": {"auto_acknowledge_hours": 2, "escalation_enabled": true}, "bookings": {"require_approval": false, "default_duration_hours": 2}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Create a unit for TEST2024 if needed
INSERT INTO units (id, building_id, unit_number, floor, bedrooms, bathrooms, square_feet, rent_amount, is_occupied) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '101', 1, 1, 1, 750, 2500.00, true)
ON CONFLICT (id) DO NOTHING;

-- Update the invite to have proper unit and building
UPDATE invites 
SET 
    unit_id = 'a1111111-1111-1111-1111-111111111111',
    building_id = '11111111-1111-1111-1111-111111111111',
    status = CASE 
        WHEN status = 'expired' THEN 'pending'
        ELSE status
    END,
    expires_at = CASE
        WHEN expires_at < NOW() THEN NOW() + INTERVAL '30 days'
        ELSE expires_at
    END
WHERE login_code = 'TEST2024';

-- Update profile if it exists to have proper unit_id
UPDATE profiles 
SET unit_id = 'a1111111-1111-1111-1111-111111111111'
WHERE id IN (
    SELECT p.id 
    FROM profiles p
    JOIN invites i ON i.email = 'test@test.com' OR p.full_name = 'Test User'
    WHERE i.login_code = 'TEST2024'
);

-- Create global maintenance categories (these work for all buildings)
INSERT INTO maintenance_categories (id, building_id, name, description, sla_hours, is_active) VALUES
('e1111111-1111-1111-1111-111111111111', NULL, 'Plumbing', 'Water, drainage, and pipe issues', 24, true),
('e2222222-2222-2222-2222-222222222222', NULL, 'Electrical', 'Power, lighting, and electrical system issues', 12, true),
('e3333333-3333-3333-3333-333333333333', NULL, 'HVAC', 'Heating, ventilation, and air conditioning', 48, true),
('e4444444-4444-4444-4444-444444444444', NULL, 'Appliances', 'Refrigerator, dishwasher, washer/dryer issues', 72, true),
('e5555555-5555-5555-5555-555555555555', NULL, 'Locks & Keys', 'Door locks, keys, and access issues', 4, true),
('e6666666-6666-6666-6666-666666666666', NULL, 'Pest Control', 'Insects, rodents, and pest issues', 48, true),
('e7777777-7777-7777-7777-777777777777', NULL, 'Windows & Doors', 'Window and door repairs or issues', 72, true),
('e8888888-8888-8888-8888-888888888888', NULL, 'Flooring', 'Carpet, tile, hardwood floor issues', 96, true),
('e9999999-9999-9999-9999-999999999999', NULL, 'Walls & Ceiling', 'Paint, drywall, ceiling issues', 96, true),
('eaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', NULL, 'Other', 'General maintenance issues not listed above', 48, true)
ON CONFLICT (id) DO UPDATE SET
    is_active = true,
    name = EXCLUDED.name,
    description = EXCLUDED.description;

-- Verify maintenance categories are available
SELECT 'Maintenance Categories Available:' as info;
SELECT 
    mc.id,
    mc.name,
    mc.description,
    mc.is_active,
    CASE 
        WHEN mc.building_id IS NULL THEN 'Global (All Buildings)'
        ELSE b.name
    END as scope
FROM maintenance_categories mc
LEFT JOIN buildings b ON mc.building_id = b.id
WHERE mc.is_active = true
ORDER BY mc.building_id NULLS FIRST, mc.name;

-- Verify the final TEST2024 setup
SELECT 'Final TEST2024 Setup:' as info;
SELECT 
    i.login_code,
    i.status as invite_status,
    i.expires_at,
    p.id as profile_id,
    p.full_name,
    p.chat_platform_id,
    u.unit_number,
    b.name as building_name,
    COUNT(DISTINCT mc.id) as available_categories
FROM invites i
LEFT JOIN profiles p ON i.email = 'test@test.com' OR p.full_name = 'Test User'
LEFT JOIN units u ON COALESCE(p.unit_id, i.unit_id) = u.id
LEFT JOIN buildings b ON u.building_id = b.id
LEFT JOIN maintenance_categories mc ON (mc.building_id = b.id OR mc.building_id IS NULL) AND mc.is_active = true
WHERE i.login_code = 'TEST2024'
GROUP BY i.login_code, i.status, i.expires_at, p.id, p.full_name, p.chat_platform_id, u.unit_number, b.name;

-- Show a success message
SELECT '✅ TEST2024 user setup complete!' as message,
       'The user should now be able to see maintenance categories when reporting issues.' as details;
