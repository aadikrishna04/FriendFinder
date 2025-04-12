-- Ensure we have the correct columns in the users table

-- Add name column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS name TEXT;

-- Add email column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS email TEXT;

-- Add avatar_url column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add calendar column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS calendar JSONB DEFAULT '[]'::jsonb;

-- Add phone_number column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add resume column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS resume TEXT;

-- Add tags column if it doesn't exist
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS tags JSONB DEFAULT '[]'::jsonb;

-- Create index on phone_number for faster lookups
DROP INDEX IF EXISTS idx_users_phone_number;
CREATE INDEX idx_users_phone_number ON public.users (phone_number);

-- Create index on tags for faster lookups
DROP INDEX IF EXISTS idx_users_tags;
CREATE INDEX idx_users_tags ON public.users USING GIN (tags);

-- Copy data from fullName to name if needed (for backwards compatibility)
UPDATE public.users
SET name = raw_user_meta_data->>'fullName'
FROM auth.users
WHERE public.users.id = auth.users.id
AND public.users.name IS NULL
AND auth.users.raw_user_meta_data->>'fullName' IS NOT NULL;

-- Example queries for testing:

-- Find users with matching phone numbers
-- SELECT * FROM public.users WHERE phone_number = '1234567890';

-- Find users with specific tags
-- SELECT * FROM public.users WHERE tags ? 'javascript'; 