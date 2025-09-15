-- =====================================================
-- VISITOR PASSES TIMEZONE FIX FOR PHILIPPINE TIME
-- =====================================================
-- This migration updates the visitor pass validation function
-- to properly handle Philippine Standard Time (UTC+8)

-- Drop and recreate the use_visitor_pass function with timezone awareness
DROP FUNCTION IF EXISTS use_visitor_pass(VARCHAR);

-- =====================================================
-- UPDATED FUNCTION TO USE A VISITOR PASS (TIMEZONE AWARE)
-- =====================================================
CREATE OR REPLACE FUNCTION use_visitor_pass(p_pass_code VARCHAR)
RETURNS JSON AS $$
DECLARE
    v_pass visitor_passes%ROWTYPE;
    v_result JSON;
    v_current_time_utc TIMESTAMPTZ;
    v_current_time_ph TIMESTAMPTZ;
BEGIN
    -- Get current time in UTC and Philippine time
    v_current_time_utc := NOW();
    -- Philippine time is UTC+8
    v_current_time_ph := v_current_time_utc AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Manila';
    
    -- Lock the row for update
    SELECT * INTO v_pass FROM visitor_passes
    WHERE pass_code = p_pass_code
    FOR UPDATE;
    
    -- Check if pass exists
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Invalid pass code'
        );
    END IF;
    
    -- Check if pass is active
    IF v_pass.status != 'active' THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Pass is ' || v_pass.status
        );
    END IF;
    
    -- Check if pass has expired (compare UTC times)
    IF v_pass.valid_until < v_current_time_utc THEN
        UPDATE visitor_passes 
        SET status = 'expired', updated_at = v_current_time_utc
        WHERE id = v_pass.id;
        
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Pass has expired'
        );
    END IF;
    
    -- Check if pass is not valid yet (compare UTC times)
    IF v_pass.valid_from > v_current_time_utc THEN
        -- Convert the valid_from time to Philippine time for user-friendly error message
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Pass is not valid yet. Valid from ' || 
                     to_char(v_pass.valid_from AT TIME ZONE 'Asia/Manila', 'YYYY-MM-DD HH24:MI:SS') || ' Philippine Time'
        );
    END IF;
    
    -- Update pass usage
    UPDATE visitor_passes
    SET 
        used_at = CASE WHEN used_at IS NULL THEN v_current_time_utc ELSE used_at END,
        used_count = used_count + 1,
        status = CASE 
            WHEN single_use = TRUE THEN 'used'
            ELSE status
        END,
        updated_at = v_current_time_utc
    WHERE id = v_pass.id;
    
    -- Return success with pass details
    SELECT json_build_object(
        'success', TRUE,
        'visitor_name', v_pass.visitor_name,
        'unit_id', v_pass.unit_id,
        'building_id', v_pass.building_id,
        'visitor_type', v_pass.visitor_type,
        'purpose', v_pass.purpose,
        'valid_until', v_pass.valid_until,
        'single_use', v_pass.single_use
    ) INTO v_result;
    
    RETURN v_result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- UPDATED FUNCTION TO EXPIRE OLD PASSES (TIMEZONE AWARE)
-- =====================================================
CREATE OR REPLACE FUNCTION expire_old_visitor_passes()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
    v_current_time_utc TIMESTAMPTZ;
BEGIN
    -- Get current time in UTC
    v_current_time_utc := NOW();
    
    UPDATE visitor_passes
    SET status = 'expired', updated_at = v_current_time_utc
    WHERE status = 'active' 
    AND valid_until < v_current_time_utc;
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- GRANT PERMISSIONS FOR UPDATED FUNCTIONS
-- =====================================================
GRANT EXECUTE ON FUNCTION use_visitor_pass(VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION expire_old_visitor_passes() TO authenticated, service_role;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON FUNCTION use_visitor_pass IS 'Validates and marks a visitor pass as used (Philippine timezone aware)';
COMMENT ON FUNCTION expire_old_visitor_passes IS 'Batch function to expire old passes - timezone aware';

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Visitor pass functions updated for Philippine timezone (UTC+8)';
    RAISE NOTICE '✅ Error messages now show Philippine time for user clarity';
    RAISE NOTICE '✅ All time comparisons remain in UTC for accuracy';
    RAISE NOTICE '';
    RAISE NOTICE 'Changes made:';
    RAISE NOTICE '1. Updated use_visitor_pass function to show Philippine time in error messages';
    RAISE NOTICE '2. Added timezone conversion comments for clarity';
    RAISE NOTICE '3. All database operations still use UTC for consistency';
END $$;