# 🚀 Render Deployment Checklist

## Pre-Deployment Setup

### 1. GitHub Repository
- [ ] Push code to GitHub
- [ ] Make repository public (or connect private repo to Render)

### 2. Supabase Setup
- [ ] Create Supabase project at supabase.com
- [ ] Run `supabase/schema.sql` in SQL Editor
- [ ] Run `supabase/seed.sql` for demo data
- [ ] Copy project URL and anon key

### 3. Facebook App Setup
- [ ] Create Facebook App at developers.facebook.com
- [ ] Create Facebook Page (or use existing)
- [ ] Generate Page Access Token
- [ ] Copy App Secret

## Deployment Steps

### Step 1: Deploy to Render
1. Go to [render.com](https://render.com)
2. Click "New +" → "Web Service"
3. Connect your GitHub repository
4. Configure:
   - **Name**: `inventibot`
   - **Environment**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (for demo) or Starter ($7/mo for production)

### Step 2: Add Environment Variables
In Render dashboard → Environment:

```
PORT=10000
FACEBOOK_VERIFY_TOKEN=<generate-random-string>
FACEBOOK_ACCESS_TOKEN=<your-page-access-token>
FACEBOOK_APP_SECRET=<your-app-secret>
SUPABASE_URL=<your-project-url>
SUPABASE_ANON_KEY=<your-anon-key>
```

### Step 3: Deploy
- Click "Create Web Service"
- Wait for build to complete (3-5 minutes)
- Copy your app URL: `https://inventibot.onrender.com`

### Step 4: Configure Facebook Webhook
1. In Facebook App → Messenger → Settings → Webhooks
2. Click "Add Callback URL"
3. Enter:
   - **Callback URL**: `https://inventibot.onrender.com/webhook`
   - **Verify Token**: Same as `FACEBOOK_VERIFY_TOKEN` env variable
4. Click "Verify and Save"
5. Subscribe to webhooks:
   - `messages`
   - `messaging_postbacks`
   - `messaging_optins`

### Step 5: Connect to Facebook Page
1. In Facebook App → Messenger → Settings
2. Under "Access Tokens", select your page
3. Click "Generate Token" (if needed)
4. Under "Webhooks", click "Add Subscriptions"
5. Select your page

## Post-Deployment Testing

### Test Health Check
```bash
curl https://inventibot.onrender.com/health
# Should return: {"status":"ok"}
```

### Test Bot
1. Go to your Facebook Page
2. Send a message to the page
3. Bot should respond with authentication prompt

### Setup Facebook Messenger Profile
```bash
# Run this once after deployment to set up persistent menu
curl -X POST https://inventibot.onrender.com/setup
```

## Troubleshooting

### Bot not responding?
1. Check Render logs: Dashboard → Logs
2. Verify Facebook webhook is subscribed to page
3. Check environment variables are set correctly
4. Ensure Facebook Page token is valid

### Webhook verification failing?
1. Verify `FACEBOOK_VERIFY_TOKEN` matches in both Render and Facebook
2. Check app is deployed and running
3. Test health endpoint first

### Database connection issues?
1. Verify Supabase URL format: `https://xxxxx.supabase.co`
2. Check anon key is correct
3. Ensure database tables are created

## Demo Preparation

### Create Test Data
1. Create invite codes in Supabase:
```sql
INSERT INTO invites (building_id, unit_id, full_name, login_code, status, created_by)
VALUES 
  ('11111111-1111-1111-1111-111111111111', 'a1111111-1111-1111-1111-111111111111', 
   'Demo User', 'DEMO2024', 'pending', '<admin-user-id>');
```

2. Test the flow:
   - Send message to bot
   - Enter code: DEMO2024
   - Test maintenance request
   - Test amenity booking

### Monitor Performance
- Render Dashboard shows response times
- Check logs for any errors
- Test all features before demo

## Production Considerations

For production deployment:
1. Upgrade to Render Starter plan ($7/mo) for better performance
2. Add custom domain
3. Set up monitoring (Sentry, LogRocket)
4. Configure auto-scaling
5. Add SSL certificate (included with Render)
6. Set up backup strategy for database

---

**Ready to deploy? This should take less than 10 minutes!** 🎉
