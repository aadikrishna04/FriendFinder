-- This script ensures the phone_number column is properly set up
-- and indexed for efficient queries

-- Simple schema fix for phone number column
-- This will ensure new users have their phone numbers stored correctly

-- 1. Make sure the phone_number column exists
ALTER TABLE IF EXISTS public.users 
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- 2. Create an index for faster lookups
DROP INDEX IF EXISTS idx_users_phone_number;
CREATE INDEX idx_users_phone_number ON public.users (phone_number);

-- Example query to find users by phone number:
-- SELECT * FROM public.users WHERE phone_number = '1234567890'; 