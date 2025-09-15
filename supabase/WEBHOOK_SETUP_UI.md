# Setting Up Announcement Webhooks via Supabase Dashboard

Since Supabase doesn't allow custom database parameters, we have **TWO OPTIONS**:

## Option 1: Database Webhooks (Recommended - No Code Required!)

This is the easiest method - set it up directly in the Supabase Dashboard:

### Steps:

1. **Open Supabase Dashboard**
   - Go to: https://app.supabase.com
   - Select your project

2. **Navigate to Database Webhooks**
   - In the left sidebar, click: **Database** → **Webhooks**
   - Click the **"Create a new hook"** button

3. **Configure the Webhook**
   
   Fill in these fields:
   
   **Name:** `announcement-notifications`
   
   **Table:** `announcements`
   
   **Events:** 
   - ✅ Insert
   - ✅ Update
   
   **Type:** `HTTP Request`
   
   **HTTP Request**
   - **Method:** `POST`
   - **URL:** `https://inventibot.onrender.com/webhook/announcements`
   - **HTTP Headers:**
     ```
     Content-Type: application/json
     x-webhook-secret: 5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e
     ```
   
   **Payload** (Custom):
   ```json
   {
     "type": "announcement.published",
     "announcement": {
       "id": "{id}",
       "building_id": "{building_id}",
       "title": "{title}",
       "content": "{content}",
       "category": "{category}",
       "priority": "{priority}",
       "target_units": "{target_units}",
       "published_at": "{published_at}",
       "expires_at": "{expires_at}",
       "is_published": "{is_published}"
     },
     "building_id": "{building_id}",
     "target_units": "{target_units}",
     "timestamp": "{timestamp}"
   }
   ```

4. **Add Filter (Important!)**
   
   Under **Filters**, add:
   ```
   is_published=eq.true
   ```
   This ensures webhooks only fire for published announcements.

5. **Enable the Webhook**
   - Toggle the switch to **Enabled**
   - Click **Create webhook**

### That's it! No SQL required.

## Option 2: Using the Configuration Table (Already Created)

If you prefer the SQL approach, run this in SQL Editor:
```sql
-- Run the alternative configuration script
-- File: supabase/configure_webhook_alternative.sql
```

This creates a `webhook_config` table that stores your webhook settings.

## Testing Your Webhook

### Test from Supabase Dashboard:
1. Go to **Database** → **Webhooks**
2. Find your webhook
3. Click the **"..."** menu → **"Send test"**

### Test with a Real Announcement:
```sql
-- Create a test announcement
INSERT INTO announcements (
    building_id,
    title,
    content,
    priority,
    created_by,
    is_published
) VALUES (
    (SELECT id FROM buildings LIMIT 1),
    'Test Webhook Notification',
    'This is a test to verify webhooks are working',
    'normal',
    (SELECT id FROM profiles WHERE is_manager = TRUE LIMIT 1),
    true
);
```

### Check if it worked:
1. **Check Render Logs:**
   - Go to: https://dashboard.render.com
   - Select your InventiBot service
   - Click on "Logs"
   - Look for: "Announcement webhook received"

2. **Check Webhook Logs in Supabase:**
   - Go to **Database** → **Webhooks**
   - Click on your webhook
   - Check the "Recent deliveries" section

## Troubleshooting

### Webhook not firing?
- Check the filter: `is_published=eq.true`
- Make sure the webhook is enabled
- Verify the URL is correct: `https://inventibot.onrender.com/webhook/announcements`

### Getting 401 Unauthorized?
- Check the `x-webhook-secret` header matches exactly: `5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e`
- Verify WEBHOOK_SECRET is set in Render environment variables

### Webhook fires but no notifications sent?
- Check that tenants have `chat_platform_id` set in profiles
- Verify tenants have `building_id` matching the announcement
- Check Render logs for specific errors

## Advantages of Database Webhooks

✅ **No pg_net required** - Works out of the box
✅ **Built-in retry logic** - Supabase retries failed webhooks
✅ **Webhook history** - See all webhook attempts in dashboard
✅ **Easy to modify** - Change settings without SQL
✅ **Filters support** - Only send webhooks for specific conditions

## Next Steps

1. **Set up the webhook** in Supabase Dashboard (Option 1)
2. **Add environment variable** in Render:
   - `WEBHOOK_SECRET=5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e`
3. **Deploy your bot** to Render
4. **Test** with a real announcement