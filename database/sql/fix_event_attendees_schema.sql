-- Fix event_attendees schema to properly reference auth.users
-- First, make sure the UUID extension is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing event_attendees table if it exists
DROP TABLE IF EXISTS public.event_attendees;

-- Create event_attendees table with proper foreign key references
CREATE TABLE IF NOT EXISTS public.event_attendees (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- Set up Row Level Security
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Policy for selecting attendees
CREATE POLICY "Users can view attendees of events they're involved with"
    ON public.event_attendees
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        event_id IN (
            SELECT id FROM public.events WHERE host_id = auth.uid()
        )
    );

-- Policy for inserting attendance
CREATE POLICY "Users can attend events"
    ON public.event_attendees
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy for deleting attendance
CREATE POLICY "Users can remove their own attendance"
    ON public.event_attendees
    FOR DELETE
    USING (user_id = auth.uid());

-- Fix event_attendees and users relationship problem (PGRST200 error)

-- First, ensure we have the proper references between tables
DO $$
BEGIN
  -- Create users table if it doesn't exist (should already exist in auth schema)
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
    
    ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
    
    CREATE POLICY "Users can view other users"
      ON public.users
      FOR SELECT
      USING (true);
      
    CREATE POLICY "Users can update their own profile"
      ON public.users
      FOR UPDATE
      USING (id = auth.uid());
  END IF;
  
  -- Fix the attendees table reference
  ALTER TABLE public.event_attendees 
  DROP CONSTRAINT IF EXISTS event_attendees_user_id_fkey;
  
  ALTER TABLE public.event_attendees
  ADD CONSTRAINT event_attendees_user_id_fkey
  FOREIGN KEY (user_id) 
  REFERENCES auth.users(id) ON DELETE CASCADE;
  
  -- Make sure we have a row in public.users for every auth.users entry 
  -- who has joined an event
  INSERT INTO public.users (id, email)
  SELECT DISTINCT ea.user_id, au.email
  FROM public.event_attendees ea
  JOIN auth.users au ON ea.user_id = au.id
  LEFT JOIN public.users pu ON ea.user_id = pu.id
  WHERE pu.id IS NULL
  ON CONFLICT (id) DO NOTHING;
  
  RAISE NOTICE 'Successfully fixed event_attendees and users relationship';
END $$; 