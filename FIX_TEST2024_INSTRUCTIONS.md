# Fix TEST2024 User for Maintenance Requests

## Problem
The TEST2024 user cannot see maintenance categories because:
1. The user might not be properly linked to a unit/building
2. The maintenance query logic needs the proper building association

## Solution

### Step 1: Run the Fix Script in Supabase SQL Editor

Go to your Supabase dashboard and run the following SQL script in the SQL Editor:

```sql
-- Fix TEST2024 user and ensure proper linking

-- First, ensure building exists
INSERT INTO buildings (id, name, address, city, state, zip_code, country, phone, email, settings) VALUES
('11111111-1111-1111-1111-111111111111', 'Sunset Tower Apartments', '123 Sunset Boulevard', 'Los Angeles', 'CA', '90028', 'USA', '+1-310-555-0100', 'admin@sunsettower.com', 
    '{"maintenance": {"auto_acknowledge_hours": 2, "escalation_enabled": true}, "bookings": {"require_approval": false, "default_duration_hours": 2}}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Create a unit for TEST2024
INSERT INTO units (id, building_id, unit_number, floor, bedrooms, bathrooms, square_feet, rent_amount, is_occupied) VALUES
('a1111111-1111-1111-1111-111111111111', '11111111-1111-1111-1111-111111111111', '101', 1, 1, 1, 750, 2500.00, true)
ON CONFLICT (id) DO NOTHING;

-- Update the TEST2024 invite to have proper unit and building
UPDATE invites 
SET 
    unit_id = 'a1111111-1111-1111-1111-111111111111',
    building_id = '11111111-1111-1111-1111-111111111111',
    status = 'pending',  -- Reset to pending if needed
    expires_at = NOW() + INTERVAL '30 days'  -- Extend expiration
WHERE login_code = 'TEST2024';

-- Update the profile if it exists
UPDATE profiles 
SET unit_id = 'a1111111-1111-1111-1111-111111111111'
WHERE chat_platform_id IN (
    SELECT chat_platform_id 
    FROM profiles p
    JOIN invites i ON (p.full_name = 'Test User' OR i.email = 'test@test.com')
    WHERE i.login_code = 'TEST2024' AND p.chat_platform_id IS NOT NULL
);

-- Verify the setup
SELECT 
    i.login_code,
    i.status,
    p.full_name,
    p.chat_platform_id as facebook_id,
    u.unit_number,
    b.name as building_name,
    COUNT(DISTINCT mc.id) as available_maintenance_categories
FROM invites i
LEFT JOIN profiles p ON p.full_name = 'Test User'
LEFT JOIN units u ON COALESCE(p.unit_id, i.unit_id) = u.id
LEFT JOIN buildings b ON u.building_id = b.id
LEFT JOIN maintenance_categories mc ON (mc.building_id = b.id OR mc.building_id IS NULL) AND mc.is_active = true
WHERE i.login_code = 'TEST2024'
GROUP BY i.login_code, i.status, p.full_name, p.chat_platform_id, u.unit_number, b.name;
```

### Step 2: If User is Already Authenticated

If the TEST2024 user has already authenticated with the bot, you may need to:

1. **Option A: Re-authenticate**
   - Send any message to the bot
   - The bot should recognize you're not authenticated
   - Enter the code `TEST2024` again

2. **Option B: Clear the Facebook ID and re-authenticate**
   ```sql
   -- Clear the Facebook platform ID to force re-authentication
   UPDATE profiles 
   SET chat_platform_id = NULL
   WHERE full_name = 'Test User';
   ```

### Step 3: Test the Fix

1. Message the bot
2. If not authenticated, enter `TEST2024`
3. Select "🔧 Report Issue" from the main menu
4. You should now see the maintenance categories:
   - Appliances
   - Electrical
   - HVAC
   - Locks & Keys
   - Plumbing
   - And potentially Marina Services if building matches

## What Changed in the Code

The maintenance handler now:
1. Better handles missing building data
2. Logs more information for debugging
3. Falls back to global categories if no building is found
4. Provides clearer error messages

## Verification Query

Run this to check if everything is set up correctly:

```sql
SELECT 
    'TEST2024 Setup Check' as check_type,
    EXISTS(SELECT 1 FROM invites WHERE login_code = 'TEST2024') as invite_exists,
    EXISTS(SELECT 1 FROM profiles WHERE full_name = 'Test User') as profile_exists,
    EXISTS(SELECT 1 FROM profiles p 
           JOIN units u ON p.unit_id = u.id 
           WHERE p.full_name = 'Test User') as has_unit,
    COUNT(*) as maintenance_categories_count
FROM maintenance_categories 
WHERE is_active = true;
```

Expected result:
- invite_exists: true
- profile_exists: true  
- has_unit: true
- maintenance_categories_count: 6 or more
