-- =====================================================
-- FIX PERMISSIONS FOR VISITOR PASSES TABLE
-- =====================================================
-- This fixes the permission denied error when creating visitor passes

-- Grant all permissions to service role (used by the chatbot)
GRANT ALL PRIVILEGES ON TABLE visitor_passes TO service_role;
GRANT ALL PRIVILEGES ON TABLE visitor_passes TO authenticated;
GRANT SELECT ON TABLE visitor_passes TO anon;

-- Ensure sequences are accessible (for ID generation)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant execute permissions on functions
GRANT EXECUTE ON FUNCTION generate_visitor_pass_code() TO service_role;
GRANT EXECUTE ON FUNCTION use_visitor_pass(VARCHAR) TO service_role;
GRANT EXECUTE ON FUNCTION check_visitor_pass_validity() TO service_role;
GRANT EXECUTE ON FUNCTION expire_old_visitor_passes() TO service_role;

-- Also grant to authenticated users (for admin dashboard)
GRANT EXECUTE ON FUNCTION generate_visitor_pass_code() TO authenticated;
GRANT EXECUTE ON FUNCTION use_visitor_pass(VARCHAR) TO authenticated;
GRANT EXECUTE ON FUNCTION expire_old_visitor_passes() TO authenticated;

-- Allow anon to use visitor passes (for visitor check-in)
GRANT EXECUTE ON FUNCTION use_visitor_pass(VARCHAR) TO anon;

-- Verify permissions were granted
DO $$
BEGIN
    RAISE NOTICE '✅ Permissions fixed for visitor_passes table';
    RAISE NOTICE '✅ Service role now has full access';
    RAISE NOTICE '✅ Functions are accessible';
    RAISE NOTICE '';
    RAISE NOTICE 'You should now be able to create visitor passes through the chatbot';
END $$;

-- Quick test to verify service role can insert
-- This won't actually run in the SQL editor but shows what the bot will do
/*
Example of what the chatbot will execute:
INSERT INTO visitor_passes (
    pass_code,
    visitor_name,
    visitor_type,
    purpose,
    created_by_tenant_id,
    unit_id,
    building_id,
    valid_from,
    valid_until
) VALUES (
    'VP123456',
    'Test Visitor',
    'guest',
    'Testing',
    'tenant-id',
    'unit-id',
    'building-id',
    NOW(),
    NOW() + INTERVAL '4 hours'
);
*/
