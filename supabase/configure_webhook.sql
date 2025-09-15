-- =====================================================
-- WEBHOOK CONFIGURATION FOR INVENTIBOT
-- =====================================================
-- Run this script in your Supabase SQL Editor to configure
-- the webhook settings for announcement notifications

-- Set the webhook URL to your Render bot
ALTER DATABASE postgres SET app.webhook_url = 'https://inventibot.onrender.com/webhook/announcements';

-- Set the webhook secret (same as in your .env file)
ALTER DATABASE postgres SET app.webhook_secret = '5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e';

-- Verify the settings were applied
DO $$
BEGIN
    RAISE NOTICE 'Webhook URL: %', current_setting('app.webhook_url', true);
    RAISE NOTICE 'Webhook Secret: %', 
        CASE 
            WHEN current_setting('app.webhook_secret', true) IS NOT NULL 
            THEN '[CONFIGURED]' 
            ELSE '[NOT SET]' 
        END;
END $$;

-- Enable pg_net extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_net;

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

-- Test the configuration
DO $$
DECLARE
    v_webhook_url TEXT;
    v_webhook_secret TEXT;
BEGIN
    v_webhook_url := current_setting('app.webhook_url', true);
    v_webhook_secret := current_setting('app.webhook_secret', true);
    
    IF v_webhook_url IS NULL THEN
        RAISE WARNING 'Webhook URL is not configured!';
    ELSE
        RAISE NOTICE 'Webhook URL configured: %', v_webhook_url;
    END IF;
    
    IF v_webhook_secret IS NULL THEN
        RAISE WARNING 'Webhook secret is not configured!';
    ELSE
        RAISE NOTICE 'Webhook secret is configured';
    END IF;
    
    RAISE NOTICE '';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Webhook configuration complete!';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Bot URL: https://inventibot.onrender.com';
    RAISE NOTICE 'Endpoint: /webhook/announcements';
    RAISE NOTICE 'Secret: [CONFIGURED]';
    RAISE NOTICE '';
    RAISE NOTICE 'Next steps:';
    RAISE NOTICE '1. Add WEBHOOK_SECRET to Render environment variables';
    RAISE NOTICE '2. Deploy/restart your bot on Render';
    RAISE NOTICE '3. Run the announcement trigger script';
    RAISE NOTICE '========================================';
END $$;