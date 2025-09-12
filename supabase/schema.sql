-- =====================================================
-- INVENTI PROPERTY MANAGEMENT DATABASE SCHEMA
-- =====================================================
-- This schema supports both the admin dashboard and tenant chatbot
-- with full RLS (Row Level Security) and audit capabilities

-- =====================================================
-- CLEANUP (for fresh installation)
-- =====================================================
-- Uncomment these lines if you need to reset the database
-- DROP SCHEMA IF EXISTS public CASCADE;
-- CREATE SCHEMA public;

-- =====================================================
-- ENABLE NECESSARY EXTENSIONS
-- =====================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- CUSTOM TYPES
-- =====================================================

-- User roles in the system
CREATE TYPE user_role AS ENUM (
    'super_admin',  -- Full system access
    'admin',        -- Building-level admin
    'tenant',       -- Regular tenant
    'staff'         -- Maintenance staff
);

-- Status for maintenance requests
CREATE TYPE maintenance_status AS ENUM (
    'submitted',
    'acknowledged',
    'in_progress',
    'pending_parts',
    'completed',
    'cancelled'
);

-- Urgency levels for maintenance
CREATE TYPE urgency_level AS ENUM (
    'low',
    'medium',
    'high',
    'emergency'
);

-- Booking status
CREATE TYPE booking_status AS ENUM (
    'pending',
    'confirmed',
    'cancelled',
    'completed'
);

-- Invite status
CREATE TYPE invite_status AS ENUM (
    'pending',
    'claimed',
    'expired',
    'revoked'
);

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Buildings table
CREATE TABLE buildings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(50) NOT NULL,
    zip_code VARCHAR(20) NOT NULL,
    country VARCHAR(100) DEFAULT 'USA',
    phone VARCHAR(50),
    email VARCHAR(255),
    settings JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Units table
CREATE TABLE units (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    unit_number VARCHAR(50) NOT NULL,
    floor INTEGER,
    bedrooms INTEGER,
    bathrooms DECIMAL(3,1),
    square_feet INTEGER,
    rent_amount DECIMAL(10,2),
    is_occupied BOOLEAN DEFAULT FALSE,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(building_id, unit_number)
);

-- Extended user profiles (links to Supabase auth.users)
CREATE TABLE user_profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL UNIQUE,
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role user_role NOT NULL DEFAULT 'tenant',
    building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    unit_id UUID REFERENCES units(id) ON DELETE SET NULL,
    emergency_contact JSONB DEFAULT '{}',
    preferences JSONB DEFAULT '{}',
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Amenities table
CREATE TABLE amenities (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    capacity INTEGER,
    booking_rules JSONB DEFAULT '{}', -- min/max duration, advance booking, etc.
    is_bookable BOOLEAN DEFAULT TRUE,
    is_active BOOLEAN DEFAULT TRUE,
    hourly_rate DECIMAL(10,2),
    daily_rate DECIMAL(10,2),
    images JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Maintenance categories
CREATE TABLE maintenance_categories (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    sla_hours INTEGER, -- Service level agreement in hours
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(building_id, name)
);

-- Maintenance requests table
CREATE TABLE maintenance_requests (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    category_id UUID REFERENCES maintenance_categories(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    urgency urgency_level DEFAULT 'medium',
    status maintenance_status DEFAULT 'submitted',
    assigned_to UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    media_urls JSONB DEFAULT '[]',
    notes JSONB DEFAULT '[]', -- Array of notes with timestamps and authors
    resolution_notes TEXT,
    submitted_at TIMESTAMPTZ DEFAULT NOW(),
    acknowledged_at TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Amenity bookings table
CREATE TABLE bookings (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    amenity_id UUID NOT NULL REFERENCES amenities(id) ON DELETE CASCADE,
    tenant_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    status booking_status DEFAULT 'pending',
    total_cost DECIMAL(10,2),
    notes TEXT,
    cancellation_reason TEXT,
    cancelled_at TIMESTAMPTZ,
    cancelled_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_booking_times CHECK (end_time > start_time)
);

-- Invites table for tenant onboarding
CREATE TABLE invites (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    unit_id UUID NOT NULL REFERENCES units(id) ON DELETE CASCADE,
    full_name VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    phone VARCHAR(50),
    login_code VARCHAR(20) NOT NULL UNIQUE,
    status invite_status DEFAULT 'pending',
    created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    claimed_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ DEFAULT (NOW() + INTERVAL '7 days'),
    claimed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- FAQs table for chatbot
CREATE TABLE faqs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID REFERENCES buildings(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    question TEXT NOT NULL,
    answer TEXT NOT NULL,
    keywords TEXT[], -- Array of keywords for better search
    is_published BOOLEAN DEFAULT TRUE,
    priority INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    helpful_count INTEGER DEFAULT 0,
    created_by UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Announcements table
CREATE TABLE announcements (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    content TEXT NOT NULL,
    category VARCHAR(100),
    priority VARCHAR(20) DEFAULT 'normal', -- 'urgent', 'high', 'normal', 'low'
    target_units UUID[], -- Specific units, null means all
    published_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    is_published BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chatbot conversations log
CREATE TABLE chatbot_conversations (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
    session_id VARCHAR(255) NOT NULL,
    messages JSONB NOT NULL DEFAULT '[]',
    metadata JSONB DEFAULT '{}',
    started_at TIMESTAMPTZ DEFAULT NOW(),
    ended_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    table_name VARCHAR(100) NOT NULL,
    record_id UUID NOT NULL,
    action VARCHAR(20) NOT NULL, -- 'INSERT', 'UPDATE', 'DELETE'
    user_id UUID REFERENCES user_profiles(id) ON DELETE SET NULL,
    old_data JSONB,
    new_data JSONB,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Buildings indexes
CREATE INDEX idx_buildings_created_at ON buildings(created_at DESC);

-- Units indexes
CREATE INDEX idx_units_building_id ON units(building_id);
CREATE INDEX idx_units_occupied ON units(is_occupied);

-- User profiles indexes
CREATE INDEX idx_user_profiles_email ON user_profiles(email);
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_building_id ON user_profiles(building_id);
CREATE INDEX idx_user_profiles_unit_id ON user_profiles(unit_id);

-- Maintenance requests indexes
CREATE INDEX idx_maintenance_building_id ON maintenance_requests(building_id);
CREATE INDEX idx_maintenance_unit_id ON maintenance_requests(unit_id);
CREATE INDEX idx_maintenance_tenant_id ON maintenance_requests(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_urgency ON maintenance_requests(urgency);
CREATE INDEX idx_maintenance_submitted_at ON maintenance_requests(submitted_at DESC);

-- Bookings indexes
CREATE INDEX idx_bookings_building_id ON bookings(building_id);
CREATE INDEX idx_bookings_amenity_id ON bookings(amenity_id);
CREATE INDEX idx_bookings_tenant_id ON bookings(tenant_id);
CREATE INDEX idx_bookings_start_time ON bookings(start_time);
CREATE INDEX idx_bookings_status ON bookings(status);

-- Invites indexes
CREATE INDEX idx_invites_login_code ON invites(login_code);
CREATE INDEX idx_invites_status ON invites(status);
CREATE INDEX idx_invites_expires_at ON invites(expires_at);

-- FAQs indexes
CREATE INDEX idx_faqs_building_id ON faqs(building_id);
CREATE INDEX idx_faqs_category ON faqs(category);
CREATE INDEX idx_faqs_keywords ON faqs USING GIN(keywords);

-- Announcements indexes
CREATE INDEX idx_announcements_building_id ON announcements(building_id);
CREATE INDEX idx_announcements_published_at ON announcements(published_at DESC);
CREATE INDEX idx_announcements_expires_at ON announcements(expires_at);

-- Audit logs indexes
CREATE INDEX idx_audit_logs_table_name ON audit_logs(table_name);
CREATE INDEX idx_audit_logs_record_id ON audit_logs(record_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);

-- =====================================================
-- FUNCTIONS AND TRIGGERS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to all relevant tables
CREATE TRIGGER update_buildings_updated_at BEFORE UPDATE ON buildings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_units_updated_at BEFORE UPDATE ON units
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_user_profiles_updated_at BEFORE UPDATE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_amenities_updated_at BEFORE UPDATE ON amenities
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_requests_updated_at BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_bookings_updated_at BEFORE UPDATE ON bookings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_invites_updated_at BEFORE UPDATE ON invites
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_faqs_updated_at BEFORE UPDATE ON faqs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON announcements
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to generate unique invite code
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS VARCHAR(20) AS $$
DECLARE
    code VARCHAR(20);
    code_exists BOOLEAN;
BEGIN
    LOOP
        -- Generate a random 8-character alphanumeric code
        code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 8));
        
        -- Check if code already exists
        SELECT EXISTS(SELECT 1 FROM invites WHERE login_code = code) INTO code_exists;
        
        -- Exit loop if code is unique
        EXIT WHEN NOT code_exists;
    END LOOP;
    
    RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to check for booking conflicts
CREATE OR REPLACE FUNCTION check_booking_conflict(
    p_amenity_id UUID,
    p_start_time TIMESTAMPTZ,
    p_end_time TIMESTAMPTZ,
    p_exclude_booking_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM bookings
        WHERE amenity_id = p_amenity_id
        AND status IN ('confirmed', 'pending')
        AND (p_exclude_booking_id IS NULL OR id != p_exclude_booking_id)
        AND (
            (start_time <= p_start_time AND end_time > p_start_time) OR
            (start_time < p_end_time AND end_time >= p_end_time) OR
            (start_time >= p_start_time AND end_time <= p_end_time)
        )
    );
END;
$$ LANGUAGE plpgsql;

-- Function to update unit occupancy
CREATE OR REPLACE FUNCTION update_unit_occupancy()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Mark unit as occupied when tenant is assigned
        IF NEW.unit_id IS NOT NULL AND NEW.role = 'tenant' AND NEW.is_active = TRUE THEN
            UPDATE units SET is_occupied = TRUE WHERE id = NEW.unit_id;
        END IF;
    END IF;
    
    IF TG_OP = 'UPDATE' OR TG_OP = 'DELETE' THEN
        -- Check if unit should be marked as vacant
        IF OLD.unit_id IS NOT NULL AND OLD.role = 'tenant' THEN
            IF NOT EXISTS (
                SELECT 1 FROM user_profiles 
                WHERE unit_id = OLD.unit_id 
                AND role = 'tenant' 
                AND is_active = TRUE
                AND id != OLD.id
            ) THEN
                UPDATE units SET is_occupied = FALSE WHERE id = OLD.unit_id;
            END IF;
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_unit_occupancy
    AFTER INSERT OR UPDATE OR DELETE ON user_profiles
    FOR EACH ROW EXECUTE FUNCTION update_unit_occupancy();

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE units ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE amenities ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE faqs ENABLE ROW LEVEL SECURITY;
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE chatbot_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Buildings policies
CREATE POLICY "Buildings viewable by authenticated users" ON buildings
    FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Buildings manageable by admins" ON buildings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Units policies
CREATE POLICY "Units viewable by building users" ON units
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND (
                role IN ('super_admin', 'admin', 'staff')
                OR (role = 'tenant' AND building_id = units.building_id)
            )
        )
    );

CREATE POLICY "Units manageable by admins" ON units
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
            AND (role = 'super_admin' OR building_id = units.building_id)
        )
    );

-- User profiles policies
CREATE POLICY "Users can view own profile" ON user_profiles
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admins can view all profiles in their building" ON user_profiles
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles up
            WHERE up.id = auth.uid()
            AND up.role IN ('super_admin', 'admin')
            AND (up.role = 'super_admin' OR up.building_id = user_profiles.building_id)
        )
    );

CREATE POLICY "Users can update own profile" ON user_profiles
    FOR UPDATE USING (id = auth.uid())
    WITH CHECK (id = auth.uid());

CREATE POLICY "Admins can manage profiles" ON user_profiles
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Maintenance requests policies
CREATE POLICY "Tenants can view own requests" ON maintenance_requests
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Staff can view assigned requests" ON maintenance_requests
    FOR SELECT USING (
        assigned_to = auth.uid()
        OR EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'staff')
            AND (role = 'super_admin' OR building_id = maintenance_requests.building_id)
        )
    );

CREATE POLICY "Tenants can create requests" ON maintenance_requests
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Admins and staff can update requests" ON maintenance_requests
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin', 'staff')
            AND (role = 'super_admin' OR building_id = maintenance_requests.building_id)
        )
    );

-- Bookings policies
CREATE POLICY "Users can view own bookings" ON bookings
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Admins can view all bookings" ON bookings
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
            AND (role = 'super_admin' OR building_id = bookings.building_id)
        )
    );

CREATE POLICY "Tenants can create bookings" ON bookings
    FOR INSERT WITH CHECK (
        tenant_id = auth.uid()
        AND NOT check_booking_conflict(amenity_id, start_time, end_time)
    );

CREATE POLICY "Users can update own pending bookings" ON bookings
    FOR UPDATE USING (tenant_id = auth.uid() AND status = 'pending')
    WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Admins can manage all bookings" ON bookings
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
            AND (role = 'super_admin' OR building_id = bookings.building_id)
        )
    );

-- Invites policies
CREATE POLICY "Admins can manage invites" ON invites
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
            AND (role = 'super_admin' OR building_id = invites.building_id)
        )
    );

CREATE POLICY "Public can verify invite codes" ON invites
    FOR SELECT USING (status = 'pending' AND expires_at > NOW());

-- FAQs policies
CREATE POLICY "FAQs viewable by all authenticated users" ON faqs
    FOR SELECT USING (
        is_published = TRUE
        AND (
            building_id IS NULL
            OR EXISTS (
                SELECT 1 FROM user_profiles
                WHERE id = auth.uid()
                AND building_id = faqs.building_id
            )
        )
    );

CREATE POLICY "Admins can manage FAQs" ON faqs
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
            AND (role = 'super_admin' OR building_id = faqs.building_id OR faqs.building_id IS NULL)
        )
    );

-- Announcements policies
CREATE POLICY "Announcements viewable by building users" ON announcements
    FOR SELECT USING (
        is_published = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
        AND EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND building_id = announcements.building_id
            AND (
                announcements.target_units IS NULL
                OR unit_id = ANY(announcements.target_units)
            )
        )
    );

CREATE POLICY "Admins can manage announcements" ON announcements
    FOR ALL USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
            AND (role = 'super_admin' OR building_id = announcements.building_id)
        )
    );

-- Chatbot conversations policies
CREATE POLICY "Users can view own conversations" ON chatbot_conversations
    FOR SELECT USING (tenant_id = auth.uid());

CREATE POLICY "Users can create own conversations" ON chatbot_conversations
    FOR INSERT WITH CHECK (tenant_id = auth.uid());

CREATE POLICY "Admins can view all conversations" ON chatbot_conversations
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- Audit logs policies
CREATE POLICY "Audit logs viewable by admins only" ON audit_logs
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM user_profiles
            WHERE id = auth.uid()
            AND role IN ('super_admin', 'admin')
        )
    );

-- =====================================================
-- HELPER FUNCTIONS FOR APPLICATION
-- =====================================================

-- Function to get dashboard statistics
CREATE OR REPLACE FUNCTION get_dashboard_stats(p_building_id UUID)
RETURNS JSON AS $$
DECLARE
    stats JSON;
BEGIN
    SELECT json_build_object(
        'open_maintenance_requests', (
            SELECT COUNT(*) FROM maintenance_requests
            WHERE building_id = p_building_id
            AND status = 'submitted'
        ),
        'pending_invites', (
            SELECT COUNT(*) FROM invites
            WHERE building_id = p_building_id
            AND status = 'pending'
            AND expires_at > NOW()
        ),
        'todays_bookings', (
            SELECT COUNT(*) FROM bookings
            WHERE building_id = p_building_id
            AND DATE(start_time) = CURRENT_DATE
            AND status IN ('confirmed', 'pending')
        ),
        'total_units', (
            SELECT COUNT(*) FROM units
            WHERE building_id = p_building_id
        ),
        'occupied_units', (
            SELECT COUNT(*) FROM units
            WHERE building_id = p_building_id
            AND is_occupied = TRUE
        ),
        'active_tenants', (
            SELECT COUNT(*) FROM user_profiles
            WHERE building_id = p_building_id
            AND role = 'tenant'
            AND is_active = TRUE
        )
    ) INTO stats;
    
    RETURN stats;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to claim an invite
CREATE OR REPLACE FUNCTION claim_invite(
    p_invite_code VARCHAR(20),
    p_user_id UUID
)
RETURNS JSON AS $$
DECLARE
    v_invite invites%ROWTYPE;
    result JSON;
BEGIN
    -- Find the invite
    SELECT * INTO v_invite FROM invites
    WHERE login_code = p_invite_code
    AND status = 'pending'
    AND expires_at > NOW()
    FOR UPDATE;
    
    IF NOT FOUND THEN
        RETURN json_build_object(
            'success', FALSE,
            'message', 'Invalid or expired invite code'
        );
    END IF;
    
    -- Update the invite
    UPDATE invites
    SET status = 'claimed',
        claimed_by = p_user_id,
        claimed_at = NOW()
    WHERE id = v_invite.id;
    
    -- Update user profile
    UPDATE user_profiles
    SET building_id = v_invite.building_id,
        unit_id = v_invite.unit_id,
        role = 'tenant',
        is_active = TRUE
    WHERE id = p_user_id;
    
    RETURN json_build_object(
        'success', TRUE,
        'message', 'Invite claimed successfully',
        'building_id', v_invite.building_id,
        'unit_id', v_invite.unit_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant usage on schema
GRANT USAGE ON SCHEMA public TO anon, authenticated;

-- Grant all on tables to authenticated users
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Grant select on tables to anonymous users (for public endpoints)
GRANT SELECT ON invites TO anon;

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE buildings IS 'Stores information about properties/buildings managed in the system';
COMMENT ON TABLE units IS 'Individual units/apartments within buildings';
COMMENT ON TABLE user_profiles IS 'Extended user information linked to Supabase auth.users';
COMMENT ON TABLE maintenance_requests IS 'Tenant maintenance/repair requests';
COMMENT ON TABLE bookings IS 'Amenity reservations made by tenants';
COMMENT ON TABLE invites IS 'Invitation codes for tenant onboarding';
COMMENT ON TABLE faqs IS 'Frequently asked questions for chatbot responses';
COMMENT ON TABLE announcements IS 'Building-wide or unit-specific announcements';
COMMENT ON TABLE chatbot_conversations IS 'Log of chatbot interactions with tenants';
COMMENT ON TABLE audit_logs IS 'System-wide audit trail for compliance and debugging';

COMMENT ON FUNCTION get_dashboard_stats IS 'Returns aggregated statistics for admin dashboard';
COMMENT ON FUNCTION claim_invite IS 'Processes invite code redemption for new tenants';
COMMENT ON FUNCTION check_booking_conflict IS 'Validates amenity booking availability';
