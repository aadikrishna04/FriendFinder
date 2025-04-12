-- TARGETED FIX FOR INFINITE RECURSION ERROR IN EVENTS POLICY
-- This script specifically targets the "42P17" error shown in the logs

-- 1. First, drop ALL existing policies on the events table to clean up
DROP POLICY IF EXISTS "Users can read public events or events they are invited to" ON public.events;
DROP POLICY IF EXISTS "Users can view their own events and public events" ON public.events;
DROP POLICY IF EXISTS "Users can view their own events and open events" ON public.events;
DROP POLICY IF EXISTS "Users can read events" ON public.events;
DROP POLICY IF EXISTS "Event hosts can update their events" ON public.events;
DROP POLICY IF EXISTS "Anyone can read public events" ON public.events;
DROP POLICY IF EXISTS "Hosts can update their events" ON public.events;
DROP POLICY IF EXISTS "Users can create their own events" ON public.events;
DROP POLICY IF EXISTS "Users can update their own events" ON public.events;
DROP POLICY IF EXISTS "Users can delete their own events" ON public.events;

-- 2. Create a direct, simple policy for SELECT with no joins or subqueries
CREATE POLICY "Simple events read policy" 
ON public.events
FOR SELECT
USING (
  is_open = true OR
  host_id = auth.uid()
  -- Note: Not checking attendees relation here - that was causing recursion
);

-- 3. Create other basic policies that don't reference event_attendees
CREATE POLICY "Simple events insert policy" 
ON public.events
FOR INSERT
WITH CHECK (host_id = auth.uid());

CREATE POLICY "Simple events update policy" 
ON public.events
FOR UPDATE
USING (host_id = auth.uid());

CREATE POLICY "Simple events delete policy" 
ON public.events
FOR DELETE
USING (host_id = auth.uid());

-- 4. Fix related event_attendees policies
DROP POLICY IF EXISTS "Users can view attendees of events they're involved with" ON public.event_attendees;
DROP POLICY IF EXISTS "Users can view event attendees" ON public.event_attendees;

-- Create a simpler policy without circular references
CREATE POLICY "Simple attendees read policy"
ON public.event_attendees
FOR SELECT
USING (
  user_id = auth.uid() OR
  event_id IN (
    SELECT id FROM public.events WHERE host_id = auth.uid()
  )
);

-- 5. Fix user table permissions to ensure public users can be read
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view other users" ON public.users;
CREATE POLICY "Anyone can view users" 
ON public.users
FOR SELECT
USING (true);

-- 6. Make sure the extension needed for UUID generation is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp"; 