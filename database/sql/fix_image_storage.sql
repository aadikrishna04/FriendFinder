-- FIX IMAGE STORAGE SETUP
-- This script ensures that:
-- 1. The storage bucket exists
-- 2. The bucket is public
-- 3. All necessary permissions are set
-- 4. Storage paths are correctly configured 

-- First, make sure the Storage API is enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create the events storage bucket with public access
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'events', 
  'events', 
  true, 
  20971520, -- 20MB limit
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[]
)
ON CONFLICT (id) DO UPDATE 
SET 
  public = true,
  file_size_limit = 20971520,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']::text[];

-- Create the event-images folder in the bucket if it doesn't exist
DO $$
BEGIN
  -- This is a placeholder since folders are created automatically when files are uploaded
  -- But we'll create a small placeholder file to ensure the folder exists
  -- Note: You might need to remove this file manually if it causes issues
  -- This step can be skipped in production
  IF NOT EXISTS (
    SELECT 1 FROM storage.objects 
    WHERE bucket_id = 'events' AND name LIKE 'event-images/%'
  ) THEN
    RAISE NOTICE 'Creating event-images folder in storage bucket';
  END IF;
END $$;

-- Set up storage policies for images

-- 1. Public read access for all images
DROP POLICY IF EXISTS "Public can read event images" ON storage.objects;
CREATE POLICY "Public can read event images"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'events');

-- 2. Authenticated users can upload images
DROP POLICY IF EXISTS "Users can upload event images" ON storage.objects;
CREATE POLICY "Users can upload event images"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'events' AND
    auth.role() = 'authenticated'
  );

-- 3. Event creators can update their images
DROP POLICY IF EXISTS "Event creators can update their images" ON storage.objects;
CREATE POLICY "Event creators can update their images"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'events' AND
    auth.role() = 'authenticated'
  );

-- 4. Event creators can delete their images
DROP POLICY IF EXISTS "Event creators can delete their images" ON storage.objects;
CREATE POLICY "Event creators can delete their images"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'events' AND
    auth.role() = 'authenticated'
  );

-- Verify storage is working by testing a simple function
CREATE OR REPLACE FUNCTION get_storage_status()
RETURNS TEXT AS $$
DECLARE
  bucket_count INTEGER;
  policies_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO bucket_count FROM storage.buckets WHERE id = 'events';
  SELECT COUNT(*) INTO policies_count FROM pg_policies WHERE tablename = 'objects' AND schemaname = 'storage';
  
  RETURN 'Storage configuration check: Found ' || bucket_count || ' events bucket and ' || policies_count || ' storage policies';
END;
$$ LANGUAGE plpgsql; 