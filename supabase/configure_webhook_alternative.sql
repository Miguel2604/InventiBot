-- =====================================================
-- WEBHOOK CONFIGURATION FOR INVENTIBOT (ALTERNATIVE METHOD)
-- =====================================================
-- This approach uses a configuration table instead of database parameters
-- which Supabase doesn't allow for security reasons

-- Create a configuration table for webhook settings
CREATE TABLE IF NOT EXISTS webhook_config (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    service_name VARCHAR(100) NOT NULL UNIQUE,
    webhook_url TEXT NOT NULL,
    webhook_secret TEXT NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert or update the webhook configuration
INSERT INTO webhook_config (service_name, webhook_url, webhook_secret)
VALUES (
    'announcements',
    'https://inventibot.onrender.com/webhook/announcements',
    '5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e'
)
ON CONFLICT (service_name) 
DO UPDATE SET 
    webhook_url = EXCLUDED.webhook_url,
    webhook_secret = EXCLUDED.webhook_secret,
    updated_at = NOW();

-- Create the webhook logs table if it doesn't exist
CREATE TABLE IF NOT EXISTS announcement_webhook_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    announcement_id UUID REFERENCES announcements(id) ON DELETE CASCADE,
    webhook_type VARCHAR(50),
    request_id UUID,
    response_status INTEGER,
    response_body TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_webhook_logs_announcement_id 
ON announcement_webhook_logs(announcement_id);

-- Now update the trigger function to use the config table
CREATE OR REPLACE FUNCTION notify_announcement_published()
RETURNS TRIGGER AS $$
DECLARE
    webhook_url TEXT;
    webhook_secret TEXT;
    request_id UUID;
    announcement_data JSONB;
BEGIN
    -- Only trigger for published announcements
    IF NEW.is_published = TRUE AND (
        -- New announcement that's published
        (TG_OP = 'INSERT' AND NEW.is_published = TRUE) OR
        -- Existing announcement that just got published
        (TG_OP = 'UPDATE' AND OLD.is_published = FALSE AND NEW.is_published = TRUE)
    ) THEN
        
        -- Get webhook configuration from table
        SELECT wc.webhook_url, wc.webhook_secret 
        INTO webhook_url, webhook_secret
        FROM webhook_config wc
        WHERE wc.service_name = 'announcements' 
        AND wc.is_active = true
        LIMIT 1;
        
        -- Check if configuration exists
        IF webhook_url IS NULL OR webhook_secret IS NULL THEN
            RAISE WARNING 'Webhook configuration not found for announcements service';
            RETURN NEW;
        END IF;
        
        -- Prepare announcement data
        announcement_data := jsonb_build_object(
            'id', NEW.id,
            'building_id', NEW.building_id,
            'title', NEW.title,
            'content', NEW.content,
            'category', NEW.category,
            'priority', NEW.priority,
            'target_units', NEW.target_units,
            'published_at', NEW.published_at,
            'expires_at', NEW.expires_at,
            'is_published', NEW.is_published
        );
        
        -- Log the webhook attempt
        RAISE NOTICE 'Sending announcement webhook for announcement % to %', NEW.id, webhook_url;
        
        -- Send webhook using pg_net extension
        SELECT net.http_post(
            url := webhook_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-webhook-secret', webhook_secret
            ),
            body := jsonb_build_object(
                'type', 'announcement.published',
                'announcement', announcement_data,
                'building_id', NEW.building_id,
                'target_units', NEW.target_units,
                'timestamp', NOW()
            )
        ) INTO request_id;
        
        -- Log the request
        INSERT INTO announcement_webhook_logs (
            announcement_id,
            webhook_type,
            request_id,
            created_at
        ) VALUES (
            NEW.id,
            'published',
            request_id,
            NOW()
        );
        
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create or replace the trigger
DROP TRIGGER IF EXISTS trigger_announcement_published ON announcements;
CREATE TRIGGER trigger_announcement_published
    AFTER INSERT OR UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION notify_announcement_published();

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Grant necessary permissions
GRANT SELECT ON webhook_config TO authenticated;
GRANT ALL ON announcement_webhook_logs TO authenticated;

-- Verify the configuration
DO $$
DECLARE
    v_webhook_url TEXT;
    v_webhook_secret TEXT;
    v_count INTEGER;
BEGIN
    SELECT webhook_url, webhook_secret 
    INTO v_webhook_url, v_webhook_secret
    FROM webhook_config 
    WHERE service_name = 'announcements' 
    AND is_active = true;
    
    IF v_webhook_url IS NOT NULL THEN
        RAISE NOTICE '';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Webhook configuration complete!';
        RAISE NOTICE '========================================';
        RAISE NOTICE 'Service: announcements';
        RAISE NOTICE 'Bot URL: %', v_webhook_url;
        RAISE NOTICE 'Secret: [CONFIGURED]';
        RAISE NOTICE 'Status: ACTIVE';
        RAISE NOTICE '';
        RAISE NOTICE 'Configuration stored in webhook_config table';
        RAISE NOTICE '========================================';
    ELSE
        RAISE WARNING 'Webhook configuration not found!';
    END IF;
END $$;

-- Test query to verify configuration
SELECT 
    service_name,
    webhook_url,
    CASE WHEN webhook_secret IS NOT NULL THEN '[CONFIGURED]' ELSE '[NOT SET]' END as secret_status,
    is_active,
    updated_at
FROM webhook_config
WHERE service_name = 'announcements';