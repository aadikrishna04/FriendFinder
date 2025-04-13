-- Add new columns to groups table
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS member_limit INTEGER DEFAULT 20;

-- Add is_owner column to group_members table
ALTER TABLE group_members
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- Simple approach: Make one member per group the owner (the one with lowest ID)
-- For each group, get the minimum ID and update that record
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN (SELECT DISTINCT group_id FROM group_members) LOOP
    -- Find the member with the lowest ID for this group
    UPDATE group_members 
    SET is_owner = TRUE 
    WHERE id = (
      SELECT id 
      FROM group_members 
      WHERE group_id = r.group_id 
      LIMIT 1
    );
  END LOOP;
END $$;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_group_members_is_owner ON group_members(group_id, user_id, is_owner); 