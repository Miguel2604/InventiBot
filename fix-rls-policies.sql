-- Fix RLS policies to allow the authentication flow to work
-- Run this in your Supabase SQL Editor

-- First, let's check if RLS is enabled on these tables
SELECT schemaname, tablename, rowsecurity 
FROM pg_tables 
WHERE tablename IN ('invites', 'units', 'buildings', 'profiles', 'user_profiles')
  AND schemaname = 'public';

-- Enable RLS on all tables (if not already enabled)
ALTER TABLE public.buildings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.units ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

-- Create a profiles table if it doesn't exist (the auth service uses this)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    chat_platform_id VARCHAR(255) UNIQUE,
    full_name VARCHAR(255),
    unit_id UUID REFERENCES units(id),
    is_manager BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (to avoid conflicts)
DROP POLICY IF EXISTS "Allow service role full access" ON public.buildings;
DROP POLICY IF EXISTS "Allow service role full access" ON public.units;
DROP POLICY IF EXISTS "Allow service role full access" ON public.invites;
DROP POLICY IF EXISTS "Allow service role full access" ON public.user_profiles;
DROP POLICY IF EXISTS "Allow service role full access" ON public.profiles;

DROP POLICY IF EXISTS "Allow anon read for auth" ON public.buildings;
DROP POLICY IF EXISTS "Allow anon read for auth" ON public.units;
DROP POLICY IF EXISTS "Allow anon read for auth" ON public.invites;
DROP POLICY IF EXISTS "Allow anon access for auth" ON public.profiles;

-- Create policies to allow service role full access to all tables
CREATE POLICY "Allow service role full access" ON public.buildings
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON public.units
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON public.invites
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON public.user_profiles
    FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Allow service role full access" ON public.profiles
    FOR ALL USING (auth.role() = 'service_role');

-- Allow anon key to read data needed for authentication
CREATE POLICY "Allow anon read for auth" ON public.buildings
    FOR SELECT USING (true);

CREATE POLICY "Allow anon read for auth" ON public.units
    FOR SELECT USING (true);

CREATE POLICY "Allow anon read for auth" ON public.invites
    FOR SELECT USING (true);

-- Allow anon key to manage profiles (for authentication flow)
CREATE POLICY "Allow anon access for auth" ON public.profiles
    FOR ALL USING (true);

-- Allow anon to update invite status (when completing authentication)
CREATE POLICY "Allow anon update invite status" ON public.invites
    FOR UPDATE USING (true)
    WITH CHECK (status IN ('completed', 'expired'));

-- Show the policies that were created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE schemaname = 'public' 
  AND tablename IN ('buildings', 'units', 'invites', 'profiles', 'user_profiles')
ORDER BY tablename, policyname;
