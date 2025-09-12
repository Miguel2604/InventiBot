-- First, let's see what data actually exists in your database
-- Run this in your Supabase SQL Editor

-- Check what buildings exist
SELECT 'BUILDINGS:' as info, id, name, address FROM buildings;

-- Check what units exist  
SELECT 'UNITS:' as info, id, unit_number, building_id, is_occupied FROM units;

-- Check existing user_profiles
SELECT 'USER_PROFILES:' as info, id, email, full_name FROM user_profiles;

-- Check existing invites
SELECT 'INVITES:' as info, login_code, email, status, expires_at FROM invites;
