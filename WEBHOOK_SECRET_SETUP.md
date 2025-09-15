# Webhook Secret Setup Guide

## What is the Webhook Secret?

The `WEBHOOK_SECRET` is a **password you create** to secure the communication between Supabase and your bot. It ensures that only legitimate webhook requests from your Supabase database are accepted by your bot.

## Where Does It Come From?

**YOU generate it!** It's not from Facebook, Render, or Supabase - you create it yourself.

## Step-by-Step Setup

### Step 1: Generate Your Secret

Pick ONE of these generated secrets (or run the script to generate new ones):
```bash
# Example secrets (DO NOT USE THESE - Generate your own!)
1d0ZCmq1xMBPOVFsadwcRKq6nwo9CMqDo/1ET0T2EUA=
5a5768db313fa73d6e5ce6b644ce46306a5e1090e93291c5f6353816e2bd855e
```

Or generate your own:
```bash
# Run the generator script
bash /home/miguel/Documents/GitHub/InventiBot/generate-webhook-secret.sh

# Or use this one-liner:
openssl rand -base64 32
```

### Step 2: Add to Render (Your Bot Host)

1. **Log into Render.com**
2. **Go to your InventiBot service**
3. **Click on "Environment" tab**
4. **Add new environment variable:**
   ```
   Key: WEBHOOK_SECRET
   Value: [paste your generated secret]
   ```
5. **Click "Save Changes"**
6. Your bot will automatically restart with the new secret

### Step 3: Configure in Supabase

You have two options:

#### Option A: Database Configuration (for pg_net webhook)
1. **Open Supabase SQL Editor**
2. **Run this SQL** (replace with YOUR secret):
   ```sql
   -- Set the webhook URL (your Render app URL)
   ALTER DATABASE postgres SET app.webhook_url = 'https://inventibot.onrender.com/webhook/announcements';
   
   -- Set the webhook secret (same as in Render)
   ALTER DATABASE postgres SET app.webhook_secret = 'YOUR_GENERATED_SECRET_HERE';
   ```

#### Option B: Edge Function Configuration (if using Edge Functions)
1. **In your terminal:**
   ```bash
   cd /home/miguel/Documents/GitHub/InventiBot
   
   # Set the secret in Supabase
   supabase secrets set WEBHOOK_SECRET=YOUR_GENERATED_SECRET_HERE
   
   # Also set your bot URL
   supabase secrets set CHATBOT_WEBHOOK_URL=https://inventibot.onrender.com/webhook/announcements
   ```

### Step 4: Verify Configuration

Test that everything is connected properly:

```bash
# Test webhook manually (replace with your values)
curl -X POST https://inventibot.onrender.com/webhook/announcements \
  -H "Content-Type: application/json" \
  -H "x-webhook-secret: YOUR_GENERATED_SECRET_HERE" \
  -d '{
    "type": "announcement.published",
    "announcement": {
      "id": "test-123",
      "building_id": "11111111-1111-1111-1111-111111111111",
      "title": "Test",
      "content": "Test",
      "priority": "normal",
      "is_published": true
    }
  }'
```

## Visual Flow

```
Your Generated Secret: "abc123xyz789..."
           ↓
    [SAME SECRET]
    ┌──────┴──────┐
    ↓             ↓
 RENDER        SUPABASE
 (Bot)        (Database)
    ↑             ↓
    └─────────────┘
   Webhook Request
   with Secret in Header
```

## Where Each Service Uses the Secret

| Service | Where | Purpose |
|---------|-------|---------|
| **Render** | Environment Variable: `WEBHOOK_SECRET` | To verify incoming webhooks |
| **Supabase DB** | Database Setting: `app.webhook_secret` | To sign outgoing webhooks |
| **Your Bot Code** | `process.env.WEBHOOK_SECRET` | To check webhook authenticity |

## Common Mistakes to Avoid

❌ **DON'T** use the Facebook App Secret - that's different!
❌ **DON'T** use your Supabase API keys - those are different!
❌ **DON'T** commit the secret to Git
❌ **DON'T** use a simple password like "password123"

✅ **DO** use the same secret in both Render and Supabase
✅ **DO** generate a random, complex secret
✅ **DO** keep it secret and secure
✅ **DO** use at least 32 characters

## Example .env File (Local Development)

Create a `.env` file in InventiBot directory:
```env
# Facebook Configuration (from Facebook App)
FACEBOOK_ACCESS_TOKEN=your_facebook_page_token
FACEBOOK_APP_SECRET=your_facebook_app_secret
FACEBOOK_VERIFY_TOKEN=your_verify_token

# Supabase Configuration (from Supabase Dashboard)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# Webhook Security (YOU CREATE THIS)
WEBHOOK_SECRET=YOUR_GENERATED_SECRET_HERE
```

## How It Works

1. **Admin publishes announcement** in admin panel
2. **Supabase trigger fires** and prepares webhook
3. **Supabase sends webhook** to your bot with header: `x-webhook-secret: YOUR_SECRET`
4. **Your bot checks** if the secret matches `process.env.WEBHOOK_SECRET`
5. **If match:** Bot processes the announcement and sends notifications
6. **If no match:** Bot rejects the request (security protection)

## Testing Your Setup

After configuration, test by:
1. Creating a test announcement in admin panel
2. Setting it to published
3. Check Render logs: `https://dashboard.render.com` → Your Service → Logs
4. Look for: "Announcement webhook received"

## Troubleshooting

### "Unauthorized" Error
- Secret doesn't match between Render and Supabase
- Check for typos or extra spaces

### No Webhook Received
- Check webhook URL is correct in Supabase
- Verify your Render app is running
- Check Supabase logs for webhook attempts

### "WEBHOOK_SECRET not defined"
- Environment variable not set in Render
- Restart your Render service after adding it

## Security Note

The webhook secret is like a password between Supabase and your bot. It prevents anyone else from sending fake announcement notifications to your bot. Keep it secret and secure!