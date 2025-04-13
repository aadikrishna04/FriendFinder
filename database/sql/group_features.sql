-- Add new columns to groups table
ALTER TABLE groups
ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT TRUE,
ADD COLUMN IF NOT EXISTS member_limit INTEGER DEFAULT 20;

-- Add is_owner column to group_members table
ALTER TABLE group_members
ADD COLUMN IF NOT EXISTS is_owner BOOLEAN DEFAULT FALSE;

-- We need to determine group ownership differently since created_by doesn't exist
-- Set the first member of each group as the owner without depending on created_at
WITH first_members AS (
  SELECT DISTINCT ON (group_id) id, group_id, user_id
  FROM group_members
  ORDER BY group_id, id
)
UPDATE group_members gm
SET is_owner = TRUE
FROM first_members fm
WHERE gm.id = fm.id;

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_group_members_is_owner ON group_members(group_id, user_id, is_owner); 