-- Add new columns to the users table

-- Add full_name column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS full_name TEXT;

-- Add phone_number column
ALTER TABLE users
ADD COLUMN IF NOT EXISTS phone_number TEXT NOT NULL;

-- Add resume_url column for storing the URL to the resume file
ALTER TABLE users
ADD COLUMN IF NOT EXISTS resume_url TEXT;

-- Add tags column as a JSON array
ALTER TABLE users
ADD COLUMN IF NOT EXISTS tags JSONB;

-- Add unique constraint on phone_number
ALTER TABLE users
ADD CONSTRAINT unique_phone_number UNIQUE (phone_number);

-- Create an index on tags for faster search
CREATE INDEX IF NOT EXISTS idx_users_tags ON users USING GIN (tags);

-- Create a bucket for storing resume files if it doesn't exist
-- Note: This needs to be run with appropriate permissions
DO $$
BEGIN
    -- Check if the bucket exists and create it if it doesn't
    PERFORM storage.create_bucket('user_resumes', {
        public = true,
        file_size_limit = 5242880, -- 5MB
        allowed_mime_types = '{application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document}'
    });
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Bucket already exists or could not be created';
END $$;

-- Update any RLS policies if needed
-- Add policy to allow the authenticated user to access their own files
CREATE POLICY "Users can access their own resumes"
ON storage.objects
FOR ALL
USING (auth.uid()::text = (SPLIT_PART(name, '_', 1)));

-- Create a new function to match user tags with event tags
CREATE OR REPLACE FUNCTION match_user_tags_with_events(user_id UUID) 
RETURNS TABLE (event_id UUID, match_count INTEGER) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    e.id AS event_id,
    (SELECT COUNT(*) 
     FROM jsonb_array_elements_text(u.tags) AS utag
     JOIN jsonb_array_elements_text(e.tags) AS etag 
     ON utag = etag) AS match_count
  FROM users u
  JOIN events e ON true -- Assuming you have an events table
  WHERE u.id = user_id
  ORDER BY match_count DESC;
END;
$$ LANGUAGE plpgsql; 