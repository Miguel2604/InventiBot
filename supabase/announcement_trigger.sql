-- =====================================================
-- ANNOUNCEMENT NOTIFICATION TRIGGER
-- =====================================================
-- This trigger sends a webhook to the chatbot when a new
-- announcement is published or an existing one is updated to published

-- Create a function to send webhook notification
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
        
        -- Get webhook URL from environment or use default
        -- In production, store this in a settings table or Vault
        webhook_url := current_setting('app.webhook_url', true);
        webhook_secret := current_setting('app.webhook_secret', true);
        
        -- If not set, use default (update this to your actual webhook URL)
        IF webhook_url IS NULL THEN
            webhook_url := 'https://your-bot-domain.com/webhook/announcements';
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
        RAISE NOTICE 'Sending announcement webhook for announcement %', NEW.id;
        
        -- Send webhook using pg_net extension
        -- Note: You need to enable pg_net extension in Supabase
        SELECT net.http_post(
            url := webhook_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'x-webhook-secret', COALESCE(webhook_secret, 'default-secret')
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

-- Create the trigger
DROP TRIGGER IF EXISTS trigger_announcement_published ON announcements;
CREATE TRIGGER trigger_announcement_published
    AFTER INSERT OR UPDATE ON announcements
    FOR EACH ROW
    EXECUTE FUNCTION notify_announcement_published();

-- Create a table to log webhook attempts (optional but recommended)
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

-- =====================================================
-- CONFIGURATION
-- =====================================================
-- Set your webhook URL and secret (update these values)
-- In production, use Supabase Vault for secrets

-- Example (run these with your actual values):
-- ALTER DATABASE postgres SET app.webhook_url = 'https://your-bot-domain.com/webhook/announcements';
-- ALTER DATABASE postgres SET app.webhook_secret = 'your-secret-key-here';

-- Or you can use Supabase Edge Functions instead of external webhook:
-- See: create_edge_function.sql

-- =====================================================
-- TESTING
-- =====================================================
-- To test the trigger, insert or update an announcement:
/*
INSERT INTO announcements (
    building_id,
    title,
    content,
    priority,
    created_by,
    is_published
) VALUES (
    (SELECT id FROM buildings LIMIT 1),
    'Test Announcement',
    'This is a test announcement',
    'normal',
    (SELECT id FROM profiles WHERE is_manager = TRUE LIMIT 1),
    true
);
*/