# Database Migrations

This directory contains database migration scripts that have been applied to fix and improve the database schema.

## Applied Migrations

### 001_fix_bookings_foreign_keys.sql
**Date**: December 2024  
**Purpose**: Updates foreign key constraints in `bookings` and `maintenance_requests` tables to reference the `profiles` table instead of the deprecated `user_profiles` table.

### 002_cleanup_user_profiles.sql
**Date**: December 2024  
**Purpose**: Final cleanup migration that:
- Migrates any remaining data from `user_profiles` to `profiles`
- Drops the deprecated `user_profiles` table
- Ensures all foreign keys are properly configured

## How to Apply Migrations

1. Go to your Supabase project dashboard
2. Navigate to the SQL Editor
3. Run each migration file in numerical order
4. Verify the migration was successful by checking the output

## Important Notes

- These migrations have already been applied to the production database
- They are kept here for reference and in case you need to set up a new environment
- Always backup your database before running migrations
- The migrations are idempotent (safe to run multiple times) where possible
