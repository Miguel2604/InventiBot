# Correct Webhook Setup for Supabase Dashboard

## Step-by-Step Configuration

### 1. Open Supabase Dashboard
- Go to: https://app.supabase.com
- Select your project

### 2. Navigate to Database Webhooks
- Click: **Database** → **Webhooks**
- Click **"Create a new hook"** button

### 3. Configure the Webhook

Fill in these fields:

**Name:** `announcement-notifications`

**Table:** `announcements`

**Events:** 
- ✅ Insert
- ✅ Update

**Type:** `HTTP Request`

**Method:** `POST`

**URL:** `https://inventibot.onrender.com/webhook/announcements`

**HTTP Headers:**
Add these headers one by one:
- Key: `Content-Type` | Value: `application/json`
- Key: `x-webhook-secret` | Value: `5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e`

**HTTP Parameters:** (Leave empty - not needed)

**Filters:** 
Add this filter to only send webhooks for published announcements:
- Column: `is_published`
- Operator: `eq`
- Value: `true`

### 4. Enable and Save
- Toggle the switch to **Enabled**
- Click **Create webhook**

## What Supabase Sends

Supabase automatically sends this payload format:
```json
{
  "type": "INSERT" or "UPDATE",
  "table": "announcements",
  "schema": "public",
  "record": {
    "id": "...",
    "building_id": "...",
    "title": "...",
    "content": "...",
    "priority": "...",
    "is_published": true,
    // ... all other columns
  },
  "old_record": { /* previous values for UPDATE */ }
}
```

## That's it!

The webhook is now configured. When an announcement is published, Supabase will automatically send the data to your bot.