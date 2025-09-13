-- Create minimal data needed for InventiBot to work
-- Run this in your Supabase SQL Editor

-- Create a sample building
INSERT INTO buildings (id, name, address, city, state, zip_code, country, phone, email, settings) VALUES
('11111111-1111-1111-1111-111111111111', 'Sunset Tower Apartments', '123 Sunset Boulevard', 'Los Angeles', 'CA', '90028', 'USA', '+1-310-555-0100', 'admin@sunsettower.com', 
    '{"maintenance": {"auto_acknowledge_hours": 2, "escalation_enabled": true}, "bookings": {"require_approval": false, "default_duration_hours": 2}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Create some units
INSERT INTO units (id, building_id, unit_number, floor, bedrooms, bathrooms, square_feet, rent_amount, is_occupied) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '101', 1, 1, 1, 750, 2500.00, true),
('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '102', 1, 2, 2, 1100, 3200.00, true),
('a3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '201', 2, 1, 1, 750, 2600.00, true),
('a4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '202', 2, 3, 2, 1500, 4500.00, false),
('a5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '301', 3, 2, 2, 1200, 3800.00, true),
('a6666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '302', 3, 1, 1, 800, 2800.00, false)
ON CONFLICT (id) DO NOTHING;

-- Create some amenities
INSERT INTO amenities (id, building_id, name, description, category, capacity, booking_rules, is_bookable, hourly_rate, daily_rate) VALUES
('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Rooftop Pool', 'Heated pool with city views', 'Recreation', 20, 
    '{"min_duration_hours": 1, "max_duration_hours": 4, "advance_booking_days": 14, "available_hours": {"start": "08:00", "end": "22:00"}}'::jsonb, true, 0, 0),
('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Gym', '24/7 fitness center with modern equipment', 'Fitness', 15,
    '{"min_duration_hours": 0.5, "max_duration_hours": 3, "advance_booking_days": 7}'::jsonb, false, 0, 0),
('c3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Party Room', 'Community room for events', 'Events', 50,
    '{"min_duration_hours": 2, "max_duration_hours": 6, "advance_booking_days": 30, "available_hours": {"start": "10:00", "end": "23:00"}}'::jsonb, true, 50, 300)
ON CONFLICT (id) DO NOTHING;

-- Create maintenance categories
INSERT INTO maintenance_categories (id, building_id, name, description, sla_hours) VALUES
('e1111111-1111-1111-1111-111111111111', NULL, 'Plumbing', 'Water, drainage, and pipe issues', 24),
('e2222222-2222-2222-2222-222222222222', NULL, 'Electrical', 'Power, lighting, and electrical system issues', 12),
('e3333333-3333-3333-3333-333333333333', NULL, 'HVAC', 'Heating, ventilation, and air conditioning', 48),
('e4444444-4444-4444-4444-444444444444', NULL, 'Appliances', 'Refrigerator, dishwasher, washer/dryer issues', 72),
('e5555555-5555-5555-5555-555555555555', NULL, 'Locks & Keys', 'Door locks, keys, and access issues', 4)
ON CONFLICT (id) DO NOTHING;

-- Create some FAQs
INSERT INTO faqs (id, building_id, category, question, answer, keywords, priority) VALUES
('f1111111-1111-1111-1111-111111111111', NULL, 'General', 'What are the office hours?', 
    'Our office is open Monday through Friday from 9:00 AM to 6:00 PM, and Saturday from 10:00 AM to 4:00 PM. We are closed on Sundays and major holidays.',
    ARRAY['hours', 'office', 'open', 'schedule'], 10),
('f2222222-2222-2222-2222-222222222222', NULL, 'Maintenance', 'How do I submit a maintenance request?',
    'You can submit a maintenance request through the resident portal, mobile app, or by calling the office. For emergencies, please call our 24/7 emergency line.',
    ARRAY['maintenance', 'repair', 'request', 'submit'], 9),
('f3333333-3333-3333-3333-333333333333', NULL, 'Rent', 'When is rent due?',
    'Rent is due on the 1st of each month. There is a grace period until the 5th. Late fees apply after the 5th of the month.',
    ARRAY['rent', 'payment', 'due', 'late fee'], 10),
('f4444444-4444-4444-4444-444444444444', NULL, 'Amenities', 'How do I book amenities?',
    'You can book amenities through the resident portal or mobile app. Some amenities require advance booking and may have time limits.',
    ARRAY['amenities', 'booking', 'reserve', 'pool', 'gym'], 8),
('f5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Parking', 'Where can I park?',
    'Each unit comes with one assigned parking space in the underground garage. Guest parking is available on a first-come, first-served basis in the visitor lot.',
    ARRAY['parking', 'garage', 'guest', 'visitor'], 7)
ON CONFLICT (id) DO NOTHING;

-- Now create your user profile
INSERT INTO user_profiles (id, email, full_name, role, building_id, unit_id, is_active)
VALUES (
    '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    'user@user.com', 
    'Test User',
    'tenant',
    '11111111-1111-1111-1111-111111111111',
    'a4444444-4444-4444-4444-444444444444', -- Unit 202 (vacant)
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
    '11111111-1111-1111-1111-111111111111',
    'a4444444-4444-4444-4444-444444444444', 
    'Test User',
    'user@user.com',
    'USERCODE',
    'pending',
    '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    NOW() + INTERVAL '7 days'
)
ON CONFLICT (login_code) DO UPDATE SET
    status = 'pending',
    expires_at = NOW() + INTERVAL '7 days';

-- Show the final result
SELECT 
    '🎉 SUCCESS! Your access code is ready:' as message,
    i.login_code as "🔑 ACCESS CODE",
    i.email as "📧 Email",
    b.name as "🏢 Building",
    u.unit_number as "🏠 Unit",
    i.status as "Status",
    i.expires_at as "⏰ Expires"
FROM invites i
JOIN buildings b ON i.building_id = b.id
JOIN units u ON i.unit_id = u.id
WHERE i.login_code = 'USERCODE';
