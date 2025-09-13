-- Fix bookings table foreign key constraint
-- This script updates the bookings table to reference the profiles table instead of user_profiles

-- First, drop the existing foreign key constraint
ALTER TABLE bookings 
DROP CONSTRAINT IF EXISTS bookings_tenant_id_fkey;

-- Add the new foreign key constraint to reference profiles table
ALTER TABLE bookings 
ADD CONSTRAINT bookings_tenant_id_fkey 
FOREIGN KEY (tenant_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Also check and fix maintenance_requests table if it has the same issue
ALTER TABLE maintenance_requests 
DROP CONSTRAINT IF EXISTS maintenance_requests_tenant_id_fkey;

ALTER TABLE maintenance_requests 
ADD CONSTRAINT maintenance_requests_tenant_id_fkey 
FOREIGN KEY (tenant_id) 
REFERENCES profiles(id) 
ON DELETE CASCADE;

-- Verify the constraints are correctly set
SELECT 
    tc.table_name, 
    kcu.column_name, 
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name 
FROM 
    information_schema.table_constraints AS tc 
    JOIN information_schema.key_column_usage AS kcu
      ON tc.constraint_name = kcu.constraint_name
      AND tc.table_schema = kcu.table_schema
    JOIN information_schema.constraint_column_usage AS ccu
      ON ccu.constraint_name = tc.constraint_name
      AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
    AND tc.table_name IN ('bookings', 'maintenance_requests')
    AND kcu.column_name = 'tenant_id';
