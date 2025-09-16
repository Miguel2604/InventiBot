-- =====================================================
-- FIX UNIT OCCUPANCY TRACKING
-- =====================================================
-- This script ensures units are properly marked as occupied
-- when tenants are assigned through invite codes

-- Step 1: Update any existing units based on tenant profiles
-- This will mark units as occupied if they have tenants (non-managers)
UPDATE units 
SET is_occupied = TRUE 
WHERE id IN (
    SELECT DISTINCT unit_id 
    FROM profiles 
    WHERE unit_id IS NOT NULL 
    AND is_manager = FALSE
);

-- Step 2: Mark units as vacant if they have no tenants
UPDATE units 
SET is_occupied = FALSE 
WHERE id NOT IN (
    SELECT DISTINCT unit_id 
    FROM profiles 
    WHERE unit_id IS NOT NULL 
    AND is_manager = FALSE
) AND is_occupied = TRUE;

-- Step 3: Ensure all tenant profiles have is_manager set to false
-- This ensures consistency for profiles created through invites
UPDATE profiles 
SET is_manager = FALSE 
WHERE unit_id IS NOT NULL 
AND is_manager IS NULL
AND chat_platform_id IS NOT NULL;

-- Step 4: Create or replace the trigger function with better handling
CREATE OR REPLACE FUNCTION update_unit_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    -- On INSERT or UPDATE: mark unit as occupied when tenant is assigned
    IF (TG_OP = 'INSERT' OR TG_OP = 'UPDATE') THEN
        IF NEW.unit_id IS NOT NULL AND NEW.is_manager = FALSE THEN
            UPDATE units SET is_occupied = TRUE WHERE id = NEW.unit_id;
            RAISE NOTICE 'Unit % marked as occupied for profile %', NEW.unit_id, NEW.id;
        END IF;
    END IF;
    
    -- On UPDATE or DELETE: check if unit should be marked as vacant
    IF (TG_OP = 'UPDATE' OR TG_OP = 'DELETE') THEN
        IF OLD.unit_id IS NOT NULL AND OLD.is_manager = FALSE THEN
            -- Check if there are other tenants in the same unit
            IF NOT EXISTS (
                SELECT 1 FROM profiles 
                WHERE unit_id = OLD.unit_id 
                AND is_manager = FALSE
                AND id != COALESCE(OLD.id, '00000000-0000-0000-0000-000000000000')
            ) THEN
                UPDATE units SET is_occupied = FALSE WHERE id = OLD.unit_id;
                RAISE NOTICE 'Unit % marked as vacant', OLD.unit_id;
            END IF;
        END IF;
    END IF;
    
    -- For DELETE operations, return OLD; otherwise return NEW
    IF TG_OP = 'DELETE' THEN
        RETURN OLD;
    ELSE
        RETURN NEW;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Step 5: Recreate the trigger to ensure it's properly attached
DROP TRIGGER IF EXISTS trigger_update_unit_occupancy ON profiles;
CREATE TRIGGER trigger_update_unit_occupancy
    AFTER INSERT OR UPDATE OR DELETE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_unit_occupancy();

-- Step 6: Show current unit occupancy status
SELECT 
    b.name as building_name,
    u.unit_number,
    u.is_occupied,
    COUNT(p.id) as tenant_count,
    STRING_AGG(p.full_name, ', ') as tenants
FROM units u
LEFT JOIN buildings b ON u.building_id = b.id
LEFT JOIN profiles p ON p.unit_id = u.id AND p.is_manager = FALSE
GROUP BY b.name, u.unit_number, u.is_occupied, u.id
ORDER BY b.name, u.unit_number;

-- Step 7: Show any inconsistencies that need attention
SELECT 
    'Units marked as occupied but have no tenants:' as issue_type,
    COUNT(*) as count
FROM units u
WHERE u.is_occupied = TRUE
AND NOT EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.unit_id = u.id 
    AND p.is_manager = FALSE
)
UNION ALL
SELECT 
    'Units marked as vacant but have tenants:' as issue_type,
    COUNT(*) as count
FROM units u
WHERE u.is_occupied = FALSE
AND EXISTS (
    SELECT 1 FROM profiles p 
    WHERE p.unit_id = u.id 
    AND p.is_manager = FALSE
);

-- Step 8: Create a helper function to manually fix unit occupancy
CREATE OR REPLACE FUNCTION fix_unit_occupancy_status()
RETURNS TABLE(
    units_marked_occupied INTEGER,
    units_marked_vacant INTEGER
) AS $$
DECLARE
    occupied_count INTEGER;
    vacant_count INTEGER;
BEGIN
    -- Mark units as occupied that have tenants
    UPDATE units u
    SET is_occupied = TRUE
    WHERE is_occupied = FALSE
    AND EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.unit_id = u.id
        AND p.is_manager = FALSE
    );
    GET DIAGNOSTICS occupied_count = ROW_COUNT;
    
    -- Mark units as vacant that have no tenants
    UPDATE units u
    SET is_occupied = FALSE
    WHERE is_occupied = TRUE
    AND NOT EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.unit_id = u.id
        AND p.is_manager = FALSE
    );
    GET DIAGNOSTICS vacant_count = ROW_COUNT;
    
    RETURN QUERY SELECT occupied_count, vacant_count;
END;
$$ LANGUAGE plpgsql;

-- You can run this function anytime to fix occupancy status:
-- SELECT * FROM fix_unit_occupancy_status();

COMMENT ON FUNCTION fix_unit_occupancy_status() IS 'Manually fix unit occupancy status based on active tenant profiles';