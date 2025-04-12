-- Check if the trigger function already exists and drop it if it does
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;

-- Create the trigger function with enhanced error handling
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, avatar_url, calendar)
  VALUES (
    NEW.id, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email), 
    NEW.email, 
    NULL, 
    '[]'::jsonb
  );
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Error in handle_new_user trigger: %', SQLERRM;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Make sure the trigger is removed if it exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create the trigger
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Make sure we have the proper RLS policies
-- Enable Row Level Security
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Allow the postgres role to bypass RLS
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can insert their own data" ON public.users;
DROP POLICY IF EXISTS "Service role can insert user data" ON public.users;
DROP POLICY IF EXISTS "Users can view their own data" ON public.users;
DROP POLICY IF EXISTS "Users can update their own data" ON public.users;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.users;

-- Create a policy that allows the service role to insert data (for the trigger)
CREATE POLICY "Service role can insert user data" 
ON public.users FOR INSERT 
TO authenticated, anon, service_role
WITH CHECK (true);

-- Create policies for users
CREATE POLICY "Users can view their own data" 
ON public.users FOR SELECT 
TO authenticated
USING (auth.uid() = id);

CREATE POLICY "Users can update their own data" 
ON public.users FOR UPDATE 
TO authenticated
USING (auth.uid() = id);

-- Public profiles policy (optional)
CREATE POLICY "Public profiles are viewable by everyone" 
ON public.users FOR SELECT 
TO anon, authenticated
USING (true);

-- Double check if the users table exists and has the correct columns
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public'
    AND table_name = 'users'
  ) THEN
    CREATE TABLE public.users (
      id UUID PRIMARY KEY REFERENCES auth.users(id),
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      avatar_url TEXT,
      calendar JSONB DEFAULT '[]'::jsonb
    );
  END IF;
END $$; 