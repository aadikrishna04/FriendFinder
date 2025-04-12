-- COMPLETE FIX FOR FRIENDFINDER APP
-- This script addresses:
-- 1. Foreign key relationship between event_attendees and users
-- 2. Image storage setup

-- PART 1: Fix users table and event_attendees relationship
DO $$
BEGIN
  -- Create public.users table that mirrors auth.users if it doesn't exist
  IF NOT EXISTS (
    SELECT FROM pg_tables 
    WHERE schemaname = 'public' 
    AND tablename = 'users'
  ) THEN
    CREATE TABLE public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
      name TEXT,
      phone_number TEXT,
      email TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
    );
    
    -- Enable RLS on users table
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    -- Policy for viewing users
    CREATE POLICY "Users can view other users" 
      ON public.users 
      FOR SELECT 
      USING (true);
      
    -- Policy for updating own profile
    CREATE POLICY "Users can update their own profile" 
      ON public.users 
      FOR UPDATE 
      USING (id = auth.uid());
      
    RAISE NOTICE 'Created public.users table';
  END IF;
  
  -- Recreate event_attendees table with proper references
  DROP TABLE IF EXISTS public.event_attendees CASCADE;
  
  CREATE TABLE public.event_attendees (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (event_id, user_id)
  );
  
  -- Enable RLS on event_attendees
  ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
  
  -- Create policies for event_attendees
  DROP POLICY IF EXISTS "Users can view attendees of events they're involved with" ON public.event_attendees;
  CREATE POLICY "Users can view attendees of events they're involved with"
    ON public.event_attendees
    FOR SELECT
    USING (
      user_id = auth.uid() OR
      event_id IN (
        SELECT id FROM public.events WHERE host_id = auth.uid()
      )
    );

  DROP POLICY IF EXISTS "Users can attend events" ON public.event_attendees;
  CREATE POLICY "Users can attend events"
    ON public.event_attendees
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

  DROP POLICY IF EXISTS "Users can remove their own attendance" ON public.event_attendees;
  CREATE POLICY "Users can remove their own attendance"
    ON public.event_attendees
    FOR DELETE
    USING (user_id = auth.uid());
    
  -- Copy any existing auth users to public.users to ensure data consistency
  INSERT INTO public.users (id, email)
  SELECT au.id, au.email
  FROM auth.users au
  LEFT JOIN public.users pu ON au.id = pu.id
  WHERE pu.id IS NULL
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Fixed event_attendees table and its policies';
END $$;

-- PART 2: Setup proper image storage
DO $$
BEGIN
  -- Create storage bucket for event images if not exists
  INSERT INTO storage.buckets (id, name, public) 
  VALUES ('events', 'events', true)
  ON CONFLICT (id) DO NOTHING;
  
  -- Set up proper storage policies for event images
  -- Drop existing policies first to avoid duplicates
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

  DROP POLICY IF EXISTS "Event creators can update their images" ON storage.objects;
  CREATE POLICY "Event creators can update their images"
    ON storage.objects
    FOR UPDATE
    USING (
      bucket_id = 'events' AND
      auth.uid() = (
        SELECT host_id FROM public.events
        WHERE image_url LIKE '%' || name
        LIMIT 1
      )
    );
    
  DROP POLICY IF EXISTS "Event creators can delete their images" ON storage.objects;
  CREATE POLICY "Event creators can delete their images"
    ON storage.objects
    FOR DELETE
    USING (
      bucket_id = 'events' AND
      auth.uid() = (
        SELECT host_id FROM public.events
        WHERE image_url LIKE '%' || name
        LIMIT 1
      )
    );
    
  RAISE NOTICE 'Setup storage for event images';
END $$;

-- PART 3: Make sure RLS policies for events table are correct
DO $$
BEGIN
  -- Drop and recreate policies to avoid conflicts
  DROP POLICY IF EXISTS "Users can read public events or events they are invited to" ON public.events;
  DROP POLICY IF EXISTS "Users can view their own events and open events" ON public.events;
  
  -- Create comprehensive policy for reading events
  CREATE POLICY "Users can read events"
    ON public.events
    FOR SELECT
    USING (
      is_open = true OR
      host_id = auth.uid() OR
      id IN (
        SELECT event_id FROM public.event_attendees 
        WHERE user_id = auth.uid()
      )
    );
  
  -- Make sure host can update their events
  DROP POLICY IF EXISTS "Event hosts can update their events" ON public.events;
  CREATE POLICY "Event hosts can update their events"
    ON public.events
    FOR UPDATE
    USING (host_id = auth.uid())
    WITH CHECK (host_id = auth.uid());
    
  RAISE NOTICE 'Fixed event table policies';
END $$; 