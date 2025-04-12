-- FINAL FIX FOR FRIEND FINDER APP
-- This script addresses both issues simultaneously

-- STEP 1: Create the public.users table that matches auth.users
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT,
  phone_number TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- STEP 2: Fix the policy recursion first by dropping problematic policies
DROP POLICY IF EXISTS "Users can read public events or events they are invited to" ON public.events;
DROP POLICY IF EXISTS "Users can view their own events and open events" ON public.events;
DROP POLICY IF EXISTS "Users can read events" ON public.events;
DROP POLICY IF EXISTS "Event hosts can update their events" ON public.events;

-- STEP 3: Create simple policies that won't cause recursion
CREATE POLICY "Anyone can read public events" 
ON public.events
FOR SELECT
USING (is_open = true OR host_id = auth.uid());

CREATE POLICY "Hosts can update their events" 
ON public.events
FOR UPDATE
USING (host_id = auth.uid())
WITH CHECK (host_id = auth.uid());

-- STEP 4: Drop and recreate event_attendees to fix the foreign key issue
DROP TABLE IF EXISTS public.event_attendees CASCADE;

CREATE TABLE public.event_attendees (
  id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (event_id, user_id)
);

ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- STEP 5: Create simplified policies for event_attendees
CREATE POLICY "Users can view event attendees"
ON public.event_attendees
FOR SELECT
USING (true); -- Allow anyone to view attendees

CREATE POLICY "Users can attend events"
ON public.event_attendees
FOR INSERT
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their attendance"
ON public.event_attendees
FOR DELETE
USING (user_id = auth.uid());

-- STEP 6: Fix storage for images
-- Create events bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create storage policies
DROP POLICY IF EXISTS "Public can read event images" ON storage.objects;
CREATE POLICY "Public can read event images"
ON storage.objects
FOR SELECT
USING (bucket_id = 'events');

DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
CREATE POLICY "Users can upload event images"
ON storage.objects
FOR INSERT
WITH CHECK (
  bucket_id = 'events' AND
  auth.role() = 'authenticated'
);

DROP POLICY IF EXISTS "Users can manage their images" ON storage.objects;
CREATE POLICY "Users can manage their images"
ON storage.objects
FOR ALL
USING (
  bucket_id = 'events' AND
  auth.role() = 'authenticated'
);

-- STEP 7: Copy existing auth users to public.users for consistency
INSERT INTO public.users (id, email)
SELECT au.id, au.email
FROM auth.users au
LEFT JOIN public.users pu ON au.id = pu.id
WHERE pu.id IS NULL
ON CONFLICT (id) DO NOTHING; 