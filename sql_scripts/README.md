# SQL Scripts

This directory contains various SQL scripts used for database maintenance and utilities.

## Directory Structure

### `/archive`
Contains historical migration and fix scripts that have been successfully applied. These are kept for reference but should not be run again.

### `/utilities`
Contains reusable utility scripts for common database operations:
- `create-invite.sql` - Create new invite codes for tenant onboarding
- `create-minimal-data.sql` - Set up minimal test data for development
- `create-single-invite.sql` - Create a single invite for testing

### `/fixes` (gitignored)
Temporary directory for work-in-progress database fixes. Scripts here are not committed to version control.

## Important Notes

- The main database schema is in `/supabase/schema.sql`
- Seed data for development is in `/supabase/seed.sql`
- Completed migrations are archived in `/supabase/migrations/archive/`

## Database Migration History

### December 2024
Successfully migrated from `user_profiles` table to `profiles` table:
- Fixed RLS policies to prevent infinite recursion
- Migrated all existing data preserving relationships
- Updated all foreign key constraints
- Removed deprecated `user_profiles` table

The application now uses the `profiles` table exclusively for user data.
