-- =====================================================
-- SEED DATA FOR INVENTI PROPERTY MANAGEMENT
-- =====================================================
-- This file contains sample data for testing and development
-- Run this after running schema.sql

-- =====================================================
-- BUILDINGS
-- =====================================================
INSERT INTO buildings (id, name, address, city, state, zip_code, country, phone, email, settings) VALUES
('11111111-1111-1111-1111-111111111111', 'Sunset Tower Apartments', '123 Sunset Boulevard', 'Los Angeles', 'CA', '90028', 'USA', '+1-310-555-0100', 'admin@sunsettower.com', 
    '{"maintenance": {"auto_acknowledge_hours": 2, "escalation_enabled": true}, "bookings": {"require_approval": false, "default_duration_hours": 2}}'),
('22222222-2222-2222-2222-222222222222', 'Marina Bay Residences', '456 Marina Way', 'San Francisco', 'CA', '94111', 'USA', '+1-415-555-0200', 'info@marinabay.com',
    '{"maintenance": {"auto_acknowledge_hours": 1, "escalation_enabled": true}, "bookings": {"require_approval": true, "default_duration_hours": 3}}');

-- =====================================================
-- UNITS
-- =====================================================
INSERT INTO units (id, building_id, unit_number, floor, bedrooms, bathrooms, square_feet, rent_amount, is_occupied) VALUES
-- Sunset Tower Units
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '101', 1, 1, 1, 750, 2500.00, true),
('a2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', '102', 1, 2, 2, 1100, 3200.00, true),
('a3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', '201', 2, 1, 1, 750, 2600.00, true),
('a4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '202', 2, 3, 2, 1500, 4500.00, false),
('a5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', '301', 3, 2, 2, 1200, 3800.00, true),
('a6666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', '302', 3, 1, 1, 800, 2800.00, false),
-- Marina Bay Units
('b1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'A1', 1, 2, 2, 1000, 3500.00, true),
('b2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'A2', 1, 1, 1, 700, 2800.00, false),
('b3333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'B1', 2, 3, 2.5, 1600, 5200.00, true),
('b4444444-4444-4444-4444-444444444444', '22222222-2222-2222-2222-222222222222', 'B2', 2, 2, 2, 1100, 3800.00, true);

-- =====================================================
-- Create test users (these would normally be created through Supabase Auth)
-- For testing purposes, we'll insert directly into profiles
-- In production, these would be created when users sign up
-- =====================================================

-- Note: These IDs should match actual Supabase auth.users IDs in your test environment
-- You'll need to create these users through Supabase Auth first and update these IDs

-- Sample user profiles (update these IDs after creating users in Supabase Auth)
-- INSERT INTO profiles (id, user_id, email, full_name, phone, role, building_id, unit_id, is_active) VALUES
-- ('admin-user-id', 'admin@sunsettower.com', 'John Admin', '+1-310-555-0101', 'admin', '11111111-1111-1111-1111-111111111111', NULL, true),
-- ('tenant1-user-id', 'tenant1@example.com', 'Sarah Johnson', '+1-310-555-1001', 'tenant', '11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', true),
-- ('tenant2-user-id', 'tenant2@example.com', 'Michael Chen', '+1-310-555-1002', 'tenant', '11111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', true);

-- =====================================================
-- AMENITIES
-- =====================================================
INSERT INTO amenities (id, building_id, name, description, category, capacity, booking_rules, is_bookable, hourly_rate, daily_rate) VALUES
-- Sunset Tower Amenities
('c1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 'Rooftop Pool', 'Heated pool with city views', 'Recreation', 20, 
    '{"min_duration_hours": 1, "max_duration_hours": 4, "advance_booking_days": 14, "available_hours": {"start": "08:00", "end": "22:00"}}', true, 0, 0),
('c2222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111', 'Gym', '24/7 fitness center with modern equipment', 'Fitness', 15,
    '{"min_duration_hours": 0.5, "max_duration_hours": 3, "advance_booking_days": 7}', false, 0, 0),
('c3333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'Party Room', 'Community room for events', 'Events', 50,
    '{"min_duration_hours": 2, "max_duration_hours": 6, "advance_booking_days": 30, "available_hours": {"start": "10:00", "end": "23:00"}}', true, 50, 300),
('c4444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', 'BBQ Area', 'Outdoor grilling area', 'Recreation', 10,
    '{"min_duration_hours": 1, "max_duration_hours": 4, "advance_booking_days": 7, "available_hours": {"start": "11:00", "end": "21:00"}}', true, 0, 0),
-- Marina Bay Amenities
('d1111111-1111-1111-1111-111111111111', '22222222-2222-2222-2222-222222222222', 'Tennis Court', 'Professional tennis court', 'Sports', 4,
    '{"min_duration_hours": 1, "max_duration_hours": 2, "advance_booking_days": 7, "available_hours": {"start": "07:00", "end": "21:00"}}', true, 25, 0),
('d2222222-2222-2222-2222-222222222222', '22222222-2222-2222-2222-222222222222', 'Business Center', 'Co-working space with WiFi', 'Business', 20,
    '{"min_duration_hours": 1, "max_duration_hours": 8, "advance_booking_days": 3}', true, 0, 0);

-- =====================================================
-- MAINTENANCE CATEGORIES
-- =====================================================
INSERT INTO maintenance_categories (id, building_id, name, description, sla_hours) VALUES
-- Global categories (available to all buildings)
('e1111111-1111-1111-1111-111111111111', NULL, 'Plumbing', 'Water, drainage, and pipe issues', 24),
('e2222222-2222-2222-2222-222222222222', NULL, 'Electrical', 'Power, lighting, and electrical system issues', 12),
('e3333333-3333-3333-3333-333333333333', NULL, 'HVAC', 'Heating, ventilation, and air conditioning', 48),
('e4444444-4444-4444-4444-444444444444', NULL, 'Appliances', 'Refrigerator, dishwasher, washer/dryer issues', 72),
('e5555555-5555-5555-5555-555555555555', NULL, 'Locks & Keys', 'Door locks, keys, and access issues', 4),
-- Building-specific categories
('e6666666-6666-6666-6666-666666666666', '11111111-1111-1111-1111-111111111111', 'Pool Maintenance', 'Pool-related issues', 24),
('e7777777-7777-7777-7777-777777777777', '22222222-2222-2222-2222-222222222222', 'Marina Services', 'Boat slip and marina issues', 48);

-- =====================================================
-- FAQs
-- =====================================================
INSERT INTO faqs (id, building_id, category, question, answer, keywords, priority) VALUES
-- Global FAQs
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
-- Building-specific FAQs
('f5555555-5555-5555-5555-555555555555', '11111111-1111-1111-1111-111111111111', 'Parking', 'Where can I park?',
    'Each unit comes with one assigned parking space in the underground garage. Guest parking is available on a first-come, first-served basis in the visitor lot.',
    ARRAY['parking', 'garage', 'guest', 'visitor'], 7),
('f6666666-6666-6666-6666-666666666666', '22222222-2222-2222-2222-222222222222', 'Marina', 'Can I rent a boat slip?',
    'Boat slips are available for rent to residents on a first-come, first-served basis. Please contact the marina office for availability and rates.',
    ARRAY['boat', 'slip', 'marina', 'dock'], 6);

=====================================================
ANNOUNCEMENTS
=====================================================
Note: These require an actual admin user ID from your profiles table
Uncomment and update the created_by ID after creating admin users

INSERT INTO announcements (id, building_id, title, content, category, priority, created_by, published_at, expires_at) VALUES
('a7111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', 
    'Pool Maintenance Schedule', 
    'The rooftop pool will be closed for routine maintenance on Monday, September 20th from 8:00 AM to 12:00 PM. We apologize for any inconvenience.',
    'Maintenance', 'normal', 'admin-user-id', NOW(), NOW() + INTERVAL '7 days'),
('a8222222-2222-2222-2222-222222222222', '11111111-1111-1111-1111-111111111111',
    'Fire Alarm Testing',
    'Annual fire alarm testing will be conducted throughout the building on Friday, September 24th from 10:00 AM to 2:00 PM. You may hear alarms during this time.',
    'Safety', 'high', 'admin-user-id', NOW(), NOW() + INTERVAL '10 days'),
('a9333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
    'Marina Bay Community BBQ',
    'Join us for our monthly community BBQ on Saturday, September 25th from 12:00 PM to 3:00 PM at the marina deck. Food and drinks provided!',
    'Events', 'normal', 'admin-user-id', NOW(), NOW() + INTERVAL '14 days');

=====================================================
SAMPLE MAINTENANCE REQUESTS
=====================================================
Note: These require actual user IDs from your Supabase auth.users table
Uncomment and update IDs after creating test users

INSERT INTO maintenance_requests (building_id, unit_id, tenant_id, category_id, title, description, urgency, status) VALUES
('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', '0bb3a1a6-5f90-4d0f-ac2f-931537245261', 
    'e1111111-1111-1111-1111-111111111111', 'Leaking Kitchen Faucet', 
    'The kitchen faucet has been dripping constantly for the past two days. Water is pooling under the sink.', 
    'medium', 'submitted'),
('11111111-1111-1111-1111-111111111111', 'a2222222-2222-2222-2222-222222222222', '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    'e3333333-3333-3333-3333-333333333333', 'AC Not Cooling',
    'The air conditioning unit is running but not cooling the apartment. Temperature stays at 80F even when set to 70F.',
    'high', 'in_progress');

=====================================================
SAMPLE BOOKINGS
=====================================================
Note: These require actual user IDs from your Supabase auth.users table
Uncomment and update IDs after creating test users

INSERT INTO bookings (building_id, amenity_id, tenant_id, start_time, end_time, status) VALUES
('11111111-1111-1111-1111-111111111111', 'c1111111-1111-1111-1111-111111111111', '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    NOW() + INTERVAL '2 days' + TIME '14:00:00', NOW() + INTERVAL '2 days' + TIME '16:00:00', 'confirmed'),
('11111111-1111-1111-1111-111111111111', 'c3333333-3333-3333-3333-333333333333', '0bb3a1a6-5f90-4d0f-ac2f-931537245261',
    NOW() + INTERVAL '7 days' + TIME '18:00:00', NOW() + INTERVAL '7 days' + TIME '22:00:00', 'pending');

=====================================================
DISPLAY SUMMARY
=====================================================
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Seed data loaded successfully!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Buildings: 2';
    RAISE NOTICE 'Units: 10 (6 occupied, 4 vacant)';
    RAISE NOTICE 'Amenities: 6';
    RAISE NOTICE 'Maintenance Categories: 7';
    RAISE NOTICE 'FAQs: 6';
    RAISE NOTICE 'Announcements: 0 (commented out - requires admin user)';
    RAISE NOTICE '';
    RAISE NOTICE 'NOTE: To add users, maintenance requests, and bookings:';
    RAISE NOTICE '1. Create test users in Supabase Auth';
    RAISE NOTICE '2. Update the user IDs in the commented sections';
    RAISE NOTICE '3. Uncomment and run those sections';
    RAISE NOTICE '========================================';
END $$;
