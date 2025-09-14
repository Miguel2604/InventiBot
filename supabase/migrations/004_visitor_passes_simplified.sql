-- =====================================================
-- VISITOR PASSES TABLE FOR VISITOR MANAGEMENT
-- SIMPLIFIED VERSION FOR CHATBOT
-- =====================================================
-- This migration adds visitor pass functionality to allow
-- tenants to create time-limited access passes for their visitors

-- Create enum for visitor types if it doesn't exist
DO $$ BEGIN
    CREATE TYPE visitor_type AS ENUM ('guest', 'delivery', 'contractor', 'service', 'other');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Create enum for pass status if it doesn't exist
DO $$ BEGIN
    CREATE TYPE pass_status AS ENUM ('active', 'used', 'expired', 'cancelled', 'revoked');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- VISITOR PASSES TABLE
-- =====================================================
CREATE TABLE IF NOT EXISTS visitor_passes (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    
    -- Pass identification
    pass_code VARCHAR(10) UNIQUE NOT NULL,
    
    -- Visitor information
    visitor_name VARCHAR(255) NOT NULL,
    visitor_phone VARCHAR(50),
    visitor_type visitor_type DEFAULT 'guest',
    purpose TEXT,
    
    -- Tenant and location information
    created_by_tenant_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    
    -- Validity period
    valid_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    valid_until TIMESTAMPTZ NOT NULL,
    single_use BOOLEAN DEFAULT FALSE,
    
    -- Usage tracking
    status pass_status DEFAULT 'active',
    used_at TIMESTAMPTZ,
    used_count INTEGER DEFAULT 0,
    
    -- Admin oversight
    admin_notified_at TIMESTAMPTZ DEFAULT NOW(),
    admin_reviewed_at TIMESTAMPTZ,
    admin_reviewed_by UUID REFERENCES profiles(id),
    admin_notes TEXT,
    revoked_at TIMESTAMPTZ,
    revoked_by UUID REFERENCES profiles(id),
    revoke_reason TEXT,
    
    -- Metadata
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================
CREATE INDEX IF NOT EXISTS idx_visitor_pass_code ON visitor_passes(pass_code) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_visitor_passes_status ON visitor_passes(status);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_tenant ON visitor_passes(created_by_tenant_id);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_building ON visitor_passes(building_id);
CREATE INDEX IF NOT EXISTS idx_visitor_passes_valid_until ON visitor_passes(valid_until) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_visitor_passes_created_at ON visitor_passes(created_at DESC);

-- =====================================================
-- FUNCTION TO GENERATE UNIQUE PASS CODE
-- =====================================================
CREATE OR REPLACE FUNCTION generate_visitor_pass_code()
RETURNS VARCHAR(10) AS $$
DECLARE
    code VARCHAR(10);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 6-character alphanumeric code (uppercase)
        -- Format: VP-XXXX (VP for Visitor Pass + 6 random chars)
        code := 'VP' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 6));
        
        -- Check if code already exists
        SELECT EXISTS(
            SELECT 1 FROM visitor_passes 
            WHERE pass_code = code
        ) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FUNCTION TO CHECK AND UPDATE PASS STATUS
-- =====================================================
CREATE OR REPLACE FUNCTION check_visitor_pass_validity()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if pass has expired
    IF NEW.valid_until < NOW() AND NEW.status = 'active' THEN
        NEW.status = 'expired';
    END IF;
    
    -- Check if single-use pass has been used
    IF NEW.single_use = TRUE AND NEW.used_count > 0 AND NEW.status = 'active' THEN
        NEW.status = 'used';
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically check pass validity
DROP TRIGGER IF EXISTS trigger_check_visitor_pass_validity ON visitor_passes;
CREATE TRIGGER trigger_check_visitor_pass_validity
    BEFORE UPDATE ON visitor_passes
    FOR EACH ROW EXECUTE FUNCTION check_visitor_pass_validity();

-- =====================================================
-- FUNCTION TO USE A VISITOR PASS
-- =====================================================
CREATE OR REPLACE FUNCTION use_visitor_pass(p_pass_code VARCHAR)
RETURNS JSON AS $$
DECLARE
    v_pass visitor_passes%ROWTYPE;
    v_result JSON;
BEGIN
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
    
    -- Check if pass has expired
    IF v_pass.valid_until < NOW() THEN
        UPDATE visitor_passes 
        SET status = 'expired', updated_at = NOW()
        WHERE id = v_pass.id;
        
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Pass has expired'
        );
    END IF;
    
    -- Check if pass is not valid yet
    IF v_pass.valid_from > NOW() THEN
        RETURN json_build_object(
            'success', FALSE,
            'error', 'Pass is not valid yet. Valid from ' || v_pass.valid_from
        );
    END IF;
    
    -- Update pass usage
    UPDATE visitor_passes
    SET 
        used_at = CASE WHEN used_at IS NULL THEN NOW() ELSE used_at END,
        used_count = used_count + 1,
        status = CASE 
            WHEN single_use = TRUE THEN 'used'
            ELSE status
        END,
        updated_at = NOW()
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
-- FUNCTION TO EXPIRE OLD PASSES (can be called periodically)
-- =====================================================
CREATE OR REPLACE FUNCTION expire_old_visitor_passes()
RETURNS INTEGER AS $$
DECLARE
    expired_count INTEGER;
BEGIN
    UPDATE visitor_passes
    SET status = 'expired', updated_at = NOW()
    WHERE status = 'active' 
    AND valid_until < NOW();
    
    GET DIAGNOSTICS expired_count = ROW_COUNT;
    
    RETURN expired_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- SIMPLIFIED RLS POLICIES (Optional - only if RLS is enabled)
-- =====================================================
-- Only enable RLS if you need it for the admin dashboard
-- The chatbot uses service role which bypasses RLS

-- Uncomment these lines if you want to enable RLS:
-- ALTER TABLE visitor_passes ENABLE ROW LEVEL SECURITY;

-- -- Allow service role full access (for chatbot)
-- CREATE POLICY "Service role has full access to visitor passes" ON visitor_passes
--     FOR ALL 
--     TO service_role
--     USING (true)
--     WITH CHECK (true);

-- -- Allow authenticated users to view passes in their building (for admin dashboard)
-- CREATE POLICY "Users can view passes in their building" ON visitor_passes
--     FOR SELECT 
--     TO authenticated
--     USING (
--         building_id IN (
--             SELECT building_id FROM profiles WHERE user_id = auth.uid()
--         )
--     );

-- -- Allow admins to manage passes in their building
-- CREATE POLICY "Admins can manage passes in their building" ON visitor_passes
--     FOR ALL 
--     TO authenticated
--     USING (
--         EXISTS (
--             SELECT 1 FROM profiles 
--             WHERE user_id = auth.uid() 
--             AND role IN ('admin', 'super_admin')
--             AND (role = 'super_admin' OR building_id = visitor_passes.building_id)
--         )
--     );

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================
-- Grant permissions for the functions
GRANT EXECUTE ON FUNCTION generate_visitor_pass_code() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION use_visitor_pass(VARCHAR) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION expire_old_visitor_passes() TO authenticated, service_role;

-- Grant table permissions
GRANT ALL ON visitor_passes TO service_role;
GRANT SELECT, INSERT, UPDATE ON visitor_passes TO authenticated;
GRANT SELECT ON visitor_passes TO anon;

-- =====================================================
-- TRIGGER FOR UPDATED_AT
-- =====================================================
-- Use the existing update_updated_at_column function if it exists
DO $$ 
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'update_updated_at_column'
    ) THEN
        DROP TRIGGER IF EXISTS update_visitor_passes_updated_at ON visitor_passes;
        CREATE TRIGGER update_visitor_passes_updated_at 
            BEFORE UPDATE ON visitor_passes
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END $$;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================
COMMENT ON TABLE visitor_passes IS 'Stores time-limited visitor access passes created by tenants';
COMMENT ON FUNCTION generate_visitor_pass_code IS 'Generates a unique 8-character code for visitor passes';
COMMENT ON FUNCTION use_visitor_pass IS 'Validates and marks a visitor pass as used';
COMMENT ON FUNCTION expire_old_visitor_passes IS 'Batch function to expire old passes - can be called via cron job';

-- =====================================================
-- VERIFICATION
-- =====================================================
DO $$
BEGIN
    RAISE NOTICE '✅ Visitor passes table created successfully';
    RAISE NOTICE '✅ Functions created: generate_visitor_pass_code, use_visitor_pass, expire_old_visitor_passes';
    RAISE NOTICE '✅ Indexes created for performance';
    RAISE NOTICE '✅ Permissions granted';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Test the pass code generation: SELECT generate_visitor_pass_code();';
    RAISE NOTICE '2. If using admin dashboard with RLS, uncomment the RLS section';
    RAISE NOTICE '3. Update TypeScript types in your application';
END $$;
