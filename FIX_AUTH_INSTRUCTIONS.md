# Authentication Fix Instructions

## The Problem
The authentication is failing due to an infinite recursion error in the RLS (Row Level Security) policies for the `user_profiles` table in Supabase.

## The Solution
Apply the SQL script `fix-auth-rls-final.sql` to your Supabase database to fix the RLS policies and resolve the authentication issues.

## Steps to Apply the Fix

1. **Open Supabase Dashboard**
   - Go to your Supabase project dashboard
   - Navigate to the SQL Editor (usually in the left sidebar)

2. **Run the Fix Script**
   - Copy the entire contents of `fix-auth-rls-final.sql`
   - Paste it into the SQL Editor
   - Click "Run" or press Ctrl+Enter

3. **Verify the Fix**
   - The script will automatically:
     - Drop problematic policies causing infinite recursion
     - Create proper `profiles` table if it doesn't exist
     - Migrate data from `user_profiles` to `profiles` if needed
     - Set up correct RLS policies for all tables
     - Create a test invite code: `TEST2024`
     - Show the current state of invites and policies

4. **Test the Authentication**
   - After the script runs successfully, test the authentication:
   ```bash
   # Check if the database connection works
   curl https://inventibot.onrender.com/debug/invites
   ```
   - You should see a JSON response with invites, not an error

5. **Test with Facebook Messenger**
   - Send a message to your Facebook Page
   - The bot should prompt for an access code
   - Enter `TEST2024` (or any valid invite code from your database)
   - You should be successfully authenticated

## What the Fix Does

1. **Removes Circular Dependencies**: Drops all existing policies that might cause infinite recursion
2. **Creates Simple Policies**: Implements straightforward, non-recursive policies
3. **Proper Table Structure**: Ensures the `profiles` table exists with correct structure
4. **Service Role Access**: Grants full access to service role for admin operations
5. **Anon Access**: Allows anonymous users to authenticate (controlled access)
6. **Test Data**: Creates a test invite code for immediate testing

## Monitoring After the Fix

### Check Render Logs
The new structured logging will show in Render's logs as JSON:
```json
{
  "timestamp": "2024-12-09T...",
  "level": "INFO",
  "service": "AUTH",
  "message": "User authenticated",
  "senderId": "...",
  "profileId": "..."
}
```

### Debug Endpoints
- Health Check: `https://inventibot.onrender.com/health`
- Database Status: `https://inventibot.onrender.com/debug/invites`

## Troubleshooting

If you still see errors after applying the fix:

1. **Check Supabase Service Role Key**
   - Ensure `SUPABASE_SERVICE_ROLE_KEY` is set correctly in Render
   - This key is needed for admin operations

2. **Verify Table Names**
   - The app uses `profiles` table, not `user_profiles`
   - If you have custom modifications, ensure table names match

3. **Check Invite Status**
   - Invites must have status = 'pending' to be valid
   - Expired invites won't work

4. **Review Logs**
   - Check Render logs for structured error messages
   - Look for specific error codes:
     - `PGRST116`: No matching records (expected for new users)
     - `42P17`: RLS policy error (should be fixed by the script)

## Success Indicators

After successfully applying the fix:

✅ `/debug/invites` returns invite list without errors
✅ Users can authenticate with valid invite codes
✅ Structured logs appear in Render dashboard
✅ No infinite recursion errors in logs
✅ Authentication flow completes successfully

## Need Help?

If issues persist after following these steps:
1. Check the Render logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure the SQL script ran without errors in Supabase
4. Try the test invite code `TEST2024` to isolate the issue
