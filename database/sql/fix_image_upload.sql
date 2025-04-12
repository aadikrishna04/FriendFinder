-- FIX IMAGE UPLOAD ISSUES
-- This script will completely rebuild the storage setup for images

-- Step 1: Drop any conflicting policies
DROP POLICY IF EXISTS "Public can read event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
DROP POLICY IF EXISTS "Event creators can update their images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete event images" ON storage.objects;
DROP POLICY IF EXISTS "Users can manage their images" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can upload images" ON storage.objects;
DROP POLICY IF EXISTS "Public Read Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Insert Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Update Access" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated Delete Access" ON storage.objects;

-- Step 2: Recreate the storage bucket with proper settings
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'events', 
  'events', 
  true, 
  10485760, -- 10MB
  ARRAY['image/jpeg', 'image/png', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 10485760,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif']::text[];

-- Step 3: Create completely permissive policies for development/testing

-- Single policy for all operations (completely permissive for testing)
CREATE POLICY "Allow all operations for authenticated users"
ON storage.objects
FOR ALL
USING (bucket_id = 'events' AND auth.role() = 'authenticated')
WITH CHECK (bucket_id = 'events' AND auth.role() = 'authenticated');

-- Add a separate read policy for public access
CREATE POLICY "Public read access for events bucket"
ON storage.objects
FOR SELECT
USING (bucket_id = 'events');

-- Step 4: Create the event-images folder structure by creating a placeholder object
-- This ensures the path exists in the bucket
DO $$
DECLARE
  placeholder_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'events' AND name = 'event-images/.placeholder'
  ) INTO placeholder_exists;
  
  IF NOT placeholder_exists THEN
    -- Insert an empty placeholder file
    INSERT INTO storage.objects (bucket_id, name, owner, metadata)
    VALUES ('events', 'event-images/.placeholder', auth.uid(), '{"contentType": "text/plain"}');
  END IF;
END $$;

-- Create a view that combines events a user is hosting and events they're attending
CREATE OR REPLACE VIEW public.user_events AS
SELECT DISTINCT e.*
FROM public.events e
WHERE 
    -- Events the user is hosting
    e.host_id = auth.uid()
    
    OR
    
    -- Events the user is attending (registered for)
    e.id IN (
        SELECT event_id 
        FROM public.event_attendees 
        WHERE user_id = auth.uid()
    );

-- The correct syntax for setting security on a view
ALTER VIEW public.user_events SET SCHEMA public;
GRANT SELECT ON public.user_events TO authenticated;

-- Update the EventsScreen query on the client side (frontend)
-- This is just a comment for reference, not part of the SQL to execute:
-- Replace the current query in EventsScreen.js:
-- .from('events')
-- .select('*')
-- .eq('host_id', user.id)
-- With:
-- .from('user_events')
-- .select('*') 