-- DIRECT FIX FOR FRIEND FINDER APP
-- This script directly fixes the key issues:
-- 1. Foreign key relationship error in event_attendees
-- 2. Image upload storage configuration
-- 3. Permission issues with table access

-- Part 1: Reset all existing problematic RLS policies
DROP POLICY IF EXISTS "Public Access Policy" ON public.events;
DROP POLICY IF EXISTS "Public Attendees Access Policy" ON public.event_attendees;
DROP POLICY IF EXISTS "Public Users Access Policy" ON public.users;

-- Part 2: Create public.users table (must exist for event_attendees to work)
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone_number TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Part 3: Completely recreate event_attendees table
DROP TABLE IF EXISTS public.event_attendees CASCADE;

CREATE TABLE public.event_attendees (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- Part 4: Create storage bucket for images (if it doesn't exist)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('events', 'events', true, 10485760)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Part 5: Set up explicit RLS policies for each table

-- Enable RLS on all tables
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Events policies
CREATE POLICY "Anyone can read events" ON public.events FOR SELECT USING (true);
CREATE POLICY "Auth users can insert events" ON public.events FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Event owners can update" ON public.events FOR UPDATE USING (auth.uid() = host_id);
CREATE POLICY "Event owners can delete" ON public.events FOR DELETE USING (auth.uid() = host_id);

-- Event attendees policies
CREATE POLICY "Anyone can read attendees" ON public.event_attendees FOR SELECT USING (true);
CREATE POLICY "Auth users can insert attendance" ON public.event_attendees FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Users can delete own attendance" ON public.event_attendees FOR DELETE USING (auth.uid() = user_id);

-- Users policies
CREATE POLICY "Anyone can read users" ON public.users FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON public.users FOR UPDATE USING (auth.uid() = id);

-- Part 6: Storage policies for image upload
DROP POLICY IF EXISTS "Public can read event images" ON storage.objects;
CREATE POLICY "Public can read event images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'events');

DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
CREATE POLICY "Users can upload event images"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'events' AND
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Users can update event images" ON storage.objects;
CREATE POLICY "Users can update event images"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'events' AND
    auth.role() = 'authenticated'
  );

DROP POLICY IF EXISTS "Users can delete event images" ON storage.objects;
CREATE POLICY "Users can delete event images"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'events' AND
    auth.role() = 'authenticated'
  );

-- Part 7: Sync existing auth users to public.users table for consistency
INSERT INTO public.users (id, email)
SELECT id, email 
FROM auth.users au
WHERE NOT EXISTS (SELECT 1 FROM public.users pu WHERE pu.id = au.id)
ON CONFLICT (id) DO NOTHING; 