# Announcements Feature Setup Guide

## Overview
This guide will help you set up the announcements feature with real-time notifications for the InventiBot chatbot.

## Features Added
- 📢 Announcements button in main menu
- View building announcements filtered by priority
- Real-time notifications when admins publish announcements
- Webhook endpoint for receiving Supabase triggers
- Unit-specific targeting support

## Prerequisites
1. InventiBot chatbot running and connected to Facebook Messenger
2. Supabase project with announcements table
3. Profiles table with `building_id` column (see admin repo fixes)

## Installation Steps

### Step 1: Install Dependencies
```bash
cd /home/miguel/Documents/GitHub/InventiBot
npm install
```

### Step 2: Update Environment Variables
Add these to your `.env` file:
```env
# Webhook security
WEBHOOK_SECRET=your-secret-key-here

# For Edge Function (if using)
CHATBOT_WEBHOOK_URL=https://your-bot-domain.com/webhook/announcements
```

### Step 3: Database Setup

#### A. Enable pg_net Extension (for database trigger method)
In Supabase SQL Editor:
```sql
-- Enable pg_net extension for HTTP requests from database
CREATE EXTENSION IF NOT EXISTS pg_net;
```

#### B. Create Webhook Trigger
Run the SQL script:
```sql
-- Run contents of: /supabase/announcement_trigger.sql
```

#### C. Configure Webhook URL
```sql
-- Set your actual webhook URL
ALTER DATABASE postgres SET app.webhook_url = 'https://your-bot-domain.com/webhook/announcements';
ALTER DATABASE postgres SET app.webhook_secret = 'your-secret-key-here';
```

### Step 4: Alternative - Use Supabase Edge Function

If you prefer using Supabase Edge Functions instead of pg_net:

#### A. Deploy Edge Function
```bash
# From InventiBot directory
cd supabase/functions/announcement-notifier

# Set environment variables
supabase secrets set CHATBOT_WEBHOOK_URL=https://your-bot-domain.com/webhook/announcements
supabase secrets set WEBHOOK_SECRET=your-secret-key-here

# Deploy the function
supabase functions deploy announcement-notifier
```

#### B. Create Database Webhook
In Supabase Dashboard:
1. Go to Database → Webhooks
2. Create new webhook:
   - Name: `announcement-notifications`
   - Table: `announcements`
   - Events: Insert, Update
   - Type: Supabase Edge Function
   - Function: `announcement-notifier`

### Step 5: Test the Feature

#### Test Announcements Display:
1. Send message to your bot
2. Click "📢 Announcements" button
3. Bot should fetch and display announcements for your building

#### Test Real-time Notifications:
1. Create an announcement from admin panel
2. Set `is_published = true`
3. Tenants should receive notification in Messenger

### Step 6: Verify Webhook Logs
Check if webhooks are being sent:
```sql
-- Check webhook logs
SELECT * FROM announcement_webhook_logs 
ORDER BY created_at DESC 
LIMIT 10;
```

## Webhook Flow

```
Admin publishes announcement
         ↓
Database trigger fires
         ↓
Webhook sent to chatbot
         ↓
Bot processes webhook
         ↓
Notifications sent to tenants via Messenger
```

## Troubleshooting

### Issue: No notifications being sent
1. Check webhook logs in database
2. Verify webhook URL is accessible
3. Check bot server logs
4. Ensure tenants have `chat_platform_id` set

### Issue: Announcements not showing
1. Verify user has `building_id` in profile
2. Check announcement is published and not expired
3. Verify RLS policies allow read access

### Issue: Webhook returns 401
1. Check `WEBHOOK_SECRET` matches in both environments
2. Verify webhook endpoint is public

### Issue: Edge Function not triggering
1. Check function logs in Supabase Dashboard
2. Verify database webhook is enabled
3. Check Edge Function environment variables

## Testing Commands

### Create Test Announcement (SQL)
```sql
INSERT INTO announcements (
    building_id,
    title,
    content,
    priority,
    created_by,
    is_published
) VALUES (
    (SELECT building_id FROM profiles WHERE is_manager = TRUE LIMIT 1),
    'Test Notification',
    'This should trigger a notification to all tenants',
    'urgent',
    (SELECT id FROM profiles WHERE is_manager = TRUE LIMIT 1),
    true
);
```

### Test Webhook Manually (curl)
```bash
curl -X POST https://your-bot-domain.com/webhook/announcements \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: your-secret-key-here" \
  -d '{
    "type": "announcement.published",
    "announcement": {
      "id": "test-123",
      "building_id": "building-uuid",
      "title": "Test Announcement",
      "content": "Test content",
      "priority": "urgent",
      "is_published": true
    },
    "building_id": "building-uuid"
  }'
```

## Security Considerations

1. **Webhook Secret**: Always use a strong secret and verify it
2. **Rate Limiting**: Implement rate limiting for notifications
3. **Tenant Privacy**: Only notify tenants in the correct building
4. **Expiry Check**: Don't send notifications for expired announcements

## Performance Tips

1. **Batch Notifications**: Process multiple tenants in batches
2. **Async Processing**: Use queue for large tenant lists
3. **Caching**: Cache building/unit data for faster lookups
4. **Throttling**: Add delays between messages to avoid Facebook rate limits

## Monitoring

### Key Metrics to Track:
- Webhook delivery success rate
- Notification send rate
- Average response time
- Failed notification count

### Suggested Logging:
```javascript
// Log all webhook events
webhookLogger.info('Announcement webhook received', {
  announcementId: announcement.id,
  buildingId: building_id,
  targetUnits: target_units?.length || 0
});

// Log notification results
webhookLogger.info('Notifications sent', {
  sent: successCount,
  failed: failureCount,
  total: totalTenants
});
```

## Future Enhancements

1. **Read Receipts**: Track which tenants viewed announcements
2. **Preferences**: Let tenants opt-out of certain categories
3. **Scheduled Announcements**: Support future publishing
4. **Rich Media**: Support images in announcements
5. **Multi-language**: Translate announcements based on tenant locale
6. **Analytics**: Track engagement metrics

## Support

For issues or questions:
1. Check bot logs: `pm2 logs inventibot`
2. Check Supabase logs in Dashboard
3. Review webhook logs in database
4. Test webhook endpoint manually

## Notes

- Announcements are filtered by building automatically
- Expired announcements are hidden from tenants
- Unit-specific targeting is supported
- Priority affects display order (urgent first)
- Maximum 10 announcements shown at once