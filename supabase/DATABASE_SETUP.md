# Database Setup Instructions

## Overview

This guide will walk you through setting up the Inventi Property Management database schema in your Supabase project. The schema supports both the admin dashboard and the tenant chatbot with comprehensive features including:

- Multi-building property management
- Tenant onboarding with invite codes
- Maintenance request tracking
- Amenity booking system
- FAQ management for chatbot
- Announcement system
- Full audit logging
- Row Level Security (RLS) for data isolation

## Prerequisites

1. **Supabase Project**: You should have already created a Supabase project
2. **Project URL and Keys**: Have your Supabase project URL and anon/public key ready (found in Project Settings > API)
3. **Database Access**: Access to the SQL Editor in your Supabase dashboard

## Step-by-Step Setup

### Step 1: Configure Environment Variables

Ensure your `.env.local` file contains your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=your_project_url_here
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY=your_anon_key_here
```

### Step 2: Run the Schema Script

1. **Navigate to SQL Editor**:
   - Open your Supabase dashboard
   - Go to the SQL Editor section (left sidebar)

2. **Create the Schema**:
   - Click "New query"
   - Copy the entire contents of `supabase/schema.sql`
   - Paste it into the SQL editor
   - Click "Run" or press `Cmd/Ctrl + Enter`

   ⏱️ **Expected Duration**: 10-30 seconds

   ✅ **Success Indicators**:
   - "Success. No rows returned" message
   - No error messages in red

### Step 3: Verify Schema Creation

Run this verification query to confirm all tables were created:

```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
```

You should see these tables:
- amenities
- announcements
- audit_logs
- bookings
- buildings
- chatbot_conversations
- faqs
- invites
- maintenance_categories
- maintenance_requests
- units
- user_profiles

### Step 4: Load Sample Data (Optional but Recommended)

1. **Load Seed Data**:
   - Create a new query in SQL Editor
   - Copy the contents of `supabase/seed.sql`
   - Paste and run the query

   ⚠️ **Note**: The seed data includes sample buildings, units, amenities, and FAQs, but user-specific data (like maintenance requests and bookings) are commented out because they require actual user IDs.

### Step 5: Create Test Users

1. **Create an Admin User**:
   - Go to Authentication > Users in Supabase
   - Click "Invite user" or "Create user"
   - Email: `admin@example.com`
   - Password: Choose a secure password
   - Note the user ID after creation

2. **Create Test Tenant Users** (optional):
   - Repeat the process for test tenants
   - Email: `tenant1@example.com`, `tenant2@example.com`
   - Note their user IDs

3. **Update User Profiles**:
   After creating users, run this SQL to set up their profiles:

   ```sql
   -- Replace the IDs with actual user IDs from Supabase Auth
   INSERT INTO user_profiles (id, email, full_name, phone, role, building_id, unit_id, is_active) 
   VALUES
   ('YOUR-ADMIN-USER-ID', 'admin@example.com', 'John Admin', '+1-555-0100', 'admin', '11111111-1111-1111-1111-111111111111', NULL, true);
   
   -- For test tenants (optional)
   -- ('YOUR-TENANT1-ID', 'tenant1@example.com', 'Sarah Johnson', '+1-555-0101', 'tenant', '11111111-1111-1111-1111-111111111111', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', true),
   -- ('YOUR-TENANT2-ID', 'tenant2@example.com', 'Michael Chen', '+1-555-0102', 'tenant', '11111111-1111-1111-1111-111111111111', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', true);
   ```

### Step 6: Test Database Functions

Test the helper functions to ensure everything is working:

1. **Test Dashboard Stats Function**:
   ```sql
   SELECT get_dashboard_stats('11111111-1111-1111-1111-111111111111');
   ```

2. **Test Invite Code Generation**:
   ```sql
   SELECT generate_invite_code();
   ```

### Step 7: Configure Storage (For Media Uploads)

1. **Create Storage Buckets**:
   - Go to Storage in your Supabase dashboard
   - Create a new bucket called `maintenance-media`
   - Set it to "Public" if you want media to be accessible via URLs
   - Create another bucket called `amenity-images` for amenity photos

2. **Set Storage Policies**:
   ```sql
   -- Allow authenticated users to upload to maintenance-media
   CREATE POLICY "Users can upload maintenance media"
   ON storage.objects FOR INSERT
   TO authenticated
   WITH CHECK (bucket_id = 'maintenance-media');

   -- Allow users to view maintenance media
   CREATE POLICY "Users can view maintenance media"
   ON storage.objects FOR SELECT
   TO authenticated
   USING (bucket_id = 'maintenance-media');
   ```

## Database Schema Overview

### Core Tables

1. **buildings**: Properties managed by the system
2. **units**: Individual apartments/units within buildings
3. **user_profiles**: Extended user information (linked to Supabase Auth)
4. **maintenance_requests**: Service requests from tenants
5. **bookings**: Amenity reservations
6. **invites**: Onboarding codes for new tenants
7. **faqs**: Knowledge base for chatbot
8. **announcements**: Building-wide notifications
9. **amenities**: Bookable facilities (pool, gym, etc.)
10. **chatbot_conversations**: Interaction logs
11. **audit_logs**: System-wide activity tracking

### Security Features

- **Row Level Security (RLS)**: Enabled on all tables
- **Role-based Access**: Different permissions for admin, staff, and tenants
- **Audit Logging**: Tracks all database changes
- **Secure Functions**: Uses SECURITY DEFINER for sensitive operations

### Key Relationships

```
Building
  ├── Units
  │   └── Tenants (User Profiles)
  ├── Amenities
  │   └── Bookings
  ├── Maintenance Categories
  │   └── Maintenance Requests
  ├── Announcements
  └── FAQs
```

## Troubleshooting

### Common Issues and Solutions

1. **"Permission denied" errors**:
   - Ensure RLS policies are properly configured
   - Check that you're authenticated when testing

2. **"Relation does not exist" errors**:
   - Run the schema.sql script completely
   - Check for any errors during schema creation

3. **Cannot create users**:
   - Ensure email confirmations are disabled for testing (Authentication > Settings)
   - Check SMTP settings if email confirmation is required

4. **Functions not working**:
   - Verify all extensions are enabled (uuid-ossp, pgcrypto)
   - Check function permissions

### Verification Queries

```sql
-- Check all custom types
SELECT typname FROM pg_type WHERE typnamespace = 'public'::regnamespace;

-- Check all functions
SELECT proname FROM pg_proc WHERE pronamespace = 'public'::regnamespace;

-- Check RLS is enabled
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public';

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

## Next Steps

1. **Test the Admin Dashboard**:
   - Log in with your admin account
   - Navigate through different sections
   - Try creating invites, managing maintenance requests

2. **Test Tenant Features**:
   - Use an invite code to onboard a tenant
   - Submit a maintenance request
   - Book an amenity

3. **Integrate with Chatbot**:
   - Use the FAQs table for knowledge base
   - Log conversations in chatbot_conversations
   - Query maintenance requests for tenant inquiries

## Resetting the Database

If you need to start fresh:

```sql
-- WARNING: This will delete all data!
DROP SCHEMA public CASCADE;
CREATE SCHEMA public;

-- Then run schema.sql again
```

## Support

For issues specific to:
- **Database schema**: Check the comments in schema.sql
- **Supabase features**: Refer to [Supabase Documentation](https://supabase.com/docs)
- **Application integration**: Check the TypeScript types in `types/database.ts`

## Schema Modifications

When modifying the schema:

1. Always update `types/database.ts` to match
2. Consider existing data migration
3. Test RLS policies thoroughly
4. Update seed data if needed
5. Document changes in migration files

Remember to always backup your data before making schema changes in production!
