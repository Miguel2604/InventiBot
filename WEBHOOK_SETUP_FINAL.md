# Final Webhook Setup Guide (Simplified)

## Supabase Dashboard Configuration

### Step 1: Create Webhook
1. Go to your Supabase Dashboard
2. Navigate to: **Database** → **Webhooks**
3. Click **"Create a new hook"**

### Step 2: Configure These Fields

| Field | Value |
|-------|-------|
| **Name** | `announcement-notifications` |
| **Table** | `announcements` |
| **Events** | ✅ Insert<br>✅ Update |
| **Type** | `HTTP Request` |
| **Method** | `POST` |
| **URL** | `https://inventibot.onrender.com/webhook/announcements` |

### Step 3: Add HTTP Headers
Click "Add header" for each:
1. **Header 1:**
   - Key: `Content-Type`
   - Value: `application/json`

2. **Header 2:**
   - Key: `x-webhook-secret`
   - Value: `5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e`

### Step 4: Enable and Save
- Toggle to **Enabled**
- Click **Create webhook**

## That's It! 🎉

Since there's no filter option, the webhook will send ALL announcement changes, but that's fine because:
- Our bot code checks `is_published` status
- It only sends notifications when an announcement is newly published
- It ignores drafts and already-published updates

## Render Environment Setup

Add this environment variable in Render:
1. Go to https://dashboard.render.com
2. Select your InventiBot service
3. Go to **Environment** tab
4. Add:
   ```
   WEBHOOK_SECRET=5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e
   ```
5. Save (service will auto-restart)

## How the Bot Handles Webhooks

The bot receives ALL announcement events but only processes them when:
```javascript
// Only send notifications if:
// 1. It's a new announcement that's published (INSERT with is_published = true)
// 2. It's an existing announcement being published (UPDATE from is_published = false to true)
```

## Testing Your Setup

### Quick Test:
```sql
-- Run in Supabase SQL Editor
INSERT INTO announcements (
    building_id,
    title,
    content,
    priority,
    created_by,
    is_published
) VALUES (
    (SELECT id FROM buildings LIMIT 1),
    'Test Webhook: ' || NOW()::text,
    'If you see this in Messenger, webhooks are working!',
    'normal',
    (SELECT id FROM profiles WHERE is_manager = TRUE LIMIT 1),
    true  -- Published immediately
);
```

### Check Results:
1. **Supabase:** Database → Webhooks → Click your webhook → See "Recent deliveries"
2. **Render:** Check logs for "Announcement webhook received"
3. **Messenger:** Tenants should get notification

## Troubleshooting

### Webhook shows in Supabase but bot doesn't react?
- Check Render environment has `WEBHOOK_SECRET` set
- Verify bot is deployed and running
- Check Render logs for errors

### Getting 401 Unauthorized?
- Secret in header must match EXACTLY: `5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e`
- No extra spaces or quotes

### Webhook fires but no Messenger notifications?
- Check tenants have `chat_platform_id` (Facebook ID) in profiles
- Verify tenants have correct `building_id`
- Look at Render logs for specific errors

## Payload Supabase Sends

```json
{
  "type": "INSERT" or "UPDATE",
  "table": "announcements", 
  "schema": "public",
  "record": {
    "id": "uuid",
    "building_id": "uuid",
    "title": "Announcement Title",
    "content": "Full content...",
    "priority": "normal",
    "is_published": true,
    "target_units": null or ["unit-id-1", "unit-id-2"],
    // ... other fields
  },
  "old_record": null or { /* previous values */ }
}
```

## Summary

✅ Webhook URL: `https://inventibot.onrender.com/webhook/announcements`
✅ Secret: `5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e`
✅ Bot filters: Only processes newly published announcements
✅ Ready to test!