-- Enable Row Level Security on the users table
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Add a policy that allows anyone to insert new rows 
-- (only during signup, so we need to check that the id matches the authenticated user)
CREATE POLICY "Allow public inserts to users table" 
ON users FOR INSERT 
WITH CHECK (auth.uid() = id);

-- Add a policy that allows users to select their own data
CREATE POLICY "Users can view their own data" 
ON users FOR SELECT 
USING (auth.uid() = id);

-- Add a policy that allows users to update their own data
CREATE POLICY "Users can update their own data" 
ON users FOR UPDATE 
USING (auth.uid() = id);

-- Public profiles policy (optional) - if you want to allow users to see other users' profiles
CREATE POLICY "Public profiles are viewable by everyone" 
ON users FOR SELECT 
USING (true); 