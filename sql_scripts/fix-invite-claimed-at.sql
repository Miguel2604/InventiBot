-- =====================================================
-- FIX MISSING CLAIMED_AT TIMESTAMPS
-- =====================================================
-- This script fixes invites that were marked as 'claimed' 
-- but don't have the claimed_at timestamp set

-- Step 1: Show invites with missing claimed_at
SELECT 
    i.id,
    i.login_code,
    i.status,
    i.claimed_at,
    i.claimed_by,
    i.updated_at,
    p.full_name as claimed_by_name
FROM invites i
LEFT JOIN profiles p ON i.claimed_by = p.id
WHERE i.status = 'claimed' 
AND i.claimed_at IS NULL;

-- Step 2: Update claimed invites that are missing claimed_at
-- Use the updated_at timestamp as an approximation
UPDATE invites
SET claimed_at = COALESCE(updated_at, NOW())
WHERE status = 'claimed'
AND claimed_at IS NULL;

-- Step 3: For invites that have been claimed but don't have claimed_by set,
-- try to match them with profiles based on unit_id
UPDATE invites i
SET claimed_by = (
    SELECT p.id 
    FROM profiles p 
    WHERE p.unit_id = i.unit_id 
    AND p.is_manager = FALSE
    LIMIT 1
)
WHERE i.status = 'claimed'
AND i.claimed_by IS NULL
AND EXISTS (
    SELECT 1 
    FROM profiles p 
    WHERE p.unit_id = i.unit_id 
    AND p.is_manager = FALSE
);

-- Step 4: Show the results after fix
SELECT 
    COUNT(*) FILTER (WHERE status = 'claimed') as total_claimed,
    COUNT(*) FILTER (WHERE status = 'claimed' AND claimed_at IS NOT NULL) as has_claimed_at,
    COUNT(*) FILTER (WHERE status = 'claimed' AND claimed_by IS NOT NULL) as has_claimed_by,
    COUNT(*) FILTER (WHERE status = 'claimed' AND claimed_at IS NULL) as missing_claimed_at,
    COUNT(*) FILTER (WHERE status = 'claimed' AND claimed_by IS NULL) as missing_claimed_by
FROM invites;

-- Step 5: Display all claimed invites with their details
SELECT 
    i.login_code as "Access Code",
    i.status as "Status",
    i.claimed_at as "Claimed At",
    p.full_name as "Claimed By",
    u.unit_number as "Unit",
    b.name as "Building"
FROM invites i
LEFT JOIN profiles p ON i.claimed_by = p.id
LEFT JOIN units u ON i.unit_id = u.id
LEFT JOIN buildings b ON i.building_id = b.id
WHERE i.status = 'claimed'
ORDER BY i.claimed_at DESC NULLS LAST;