-- Script to fix missing names for existing accounts

-- Update existing users with null names to use their email username
UPDATE public.users
SET name = SPLIT_PART(email, '@', 1)
WHERE name IS NULL AND email IS NOT NULL;

-- Make sure all users have a name (fallback to 'User' if email is also null)
UPDATE public.users
SET name = 'User-' || SUBSTR(id::text, 1, 8)
WHERE name IS NULL;

-- Log how many records were updated
DO $$
DECLARE
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO user_count FROM public.users;
  RAISE NOTICE 'Total users in database: %', user_count;
  
  SELECT COUNT(*) INTO user_count FROM public.users WHERE name IS NOT NULL;
  RAISE NOTICE 'Users with names: %', user_count;
  
  SELECT COUNT(*) INTO user_count FROM public.users WHERE name IS NULL;
  RAISE NOTICE 'Users still missing names: %', user_count;
END $$; 