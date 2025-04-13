-- SQL script to populate user names and create triggers for new users

-- First, update existing users with names from their emails (before the @ symbol)
UPDATE public.users
SET name = SPLIT_PART(email, '@', 1)
WHERE name IS NULL AND email IS NOT NULL;

-- Create a trigger function to set name from email for new users
CREATE OR REPLACE FUNCTION public.set_user_name_from_email()
RETURNS TRIGGER AS $$
BEGIN
    -- Set the name to the part of the email before the @ if name is null
    IF NEW.name IS NULL AND NEW.email IS NOT NULL THEN
        NEW.name := SPLIT_PART(NEW.email, '@', 1);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to run before insert or update on users
DROP TRIGGER IF EXISTS set_user_name_trigger ON public.users;
CREATE TRIGGER set_user_name_trigger
BEFORE INSERT OR UPDATE OF email ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.set_user_name_from_email();

-- Create a function to sync auth users to public users table
CREATE OR REPLACE FUNCTION public.sync_user_from_auth()
RETURNS TRIGGER AS $$
BEGIN
    -- Create or update the public user when an auth user is created/updated
    INSERT INTO public.users (id, email, name)
    VALUES (
        NEW.id, 
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'name', SPLIT_PART(NEW.email, '@', 1))
    )
    ON CONFLICT (id) 
    DO UPDATE SET 
        email = EXCLUDED.email,
        name = COALESCE(EXCLUDED.name, public.users.name);
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to sync auth users to public users
DROP TRIGGER IF EXISTS sync_user_trigger ON auth.users;
CREATE TRIGGER sync_user_trigger
AFTER INSERT OR UPDATE ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_user_from_auth(); 