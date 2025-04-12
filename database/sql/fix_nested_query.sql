-- FIX FOR THE FOREIGN KEY RELATIONSHIP ERROR (PGRST200)
-- This script addresses the specific error with the nested query syntax in Supabase

-- 1. Make sure the UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Fix the event_attendees table structure to properly support the nested query syntax
DROP TABLE IF EXISTS public.event_attendees CASCADE;

CREATE TABLE public.event_attendees (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  user_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE (event_id, user_id)
);

-- 3. Create a foreign key between event_attendees.user_id and users.id
ALTER TABLE public.event_attendees ADD CONSTRAINT fk_event_attendees_user
  FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;

-- 4. Add required RLS policies
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Basic policies for attendees table
CREATE POLICY "Anyone can view event attendees" 
  ON public.event_attendees FOR SELECT 
  USING (true);

CREATE POLICY "Users can manage their own attendance" 
  ON public.event_attendees FOR ALL 
  USING (user_id = auth.uid());

-- 5. Make sure we have the public.users table for the foreign key to work
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY,
  name TEXT,
  phone_number TEXT,
  email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Add a foreign key from users to auth.users if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.constraint_column_usage
    WHERE table_schema = 'public'
    AND table_name = 'users'
    AND constraint_name LIKE 'users_id_fkey%'
  ) THEN
    ALTER TABLE public.users 
    ADD CONSTRAINT users_id_fkey
    FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 6. Ensure Row Level Security for users table
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view user profiles" 
  ON public.users FOR SELECT 
  USING (true);

CREATE POLICY "Users can update their own profile" 
  ON public.users FOR UPDATE 
  USING (id = auth.uid());

-- 7. Copy existing auth users to public.users to make the JOIN work
INSERT INTO public.users (id, email)
SELECT id, email 
FROM auth.users
WHERE NOT EXISTS (
  SELECT 1 FROM public.users WHERE id = auth.users.id
)
ON CONFLICT (id) DO NOTHING;

-- 8. Fix storage for images
INSERT INTO storage.buckets (id, name, public)
VALUES ('events', 'events', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public can read event images" ON storage.objects;
CREATE POLICY "Public can read event images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'events');

DROP POLICY IF EXISTS "Anyone can upload images" ON storage.objects;
CREATE POLICY "Anyone can upload images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'events' AND auth.role() = 'authenticated');

-- 9. Clear the metadata cache to refresh the schema relationships
-- This will force Supabase to rebuild its internal cache of table relationships
SELECT pg_notify('pgrst', 'reload schema'); 