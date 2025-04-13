-- Create invitations table to track contact invitations
CREATE TABLE IF NOT EXISTS public.invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invited_name TEXT NOT NULL,
  invited_phone TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'sent', -- 'sent', 'accepted', 'rejected'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Add a unique constraint to prevent duplicate invitations
  UNIQUE (inviter_id, invited_phone)
);

-- Create trigger to update updated_at timestamp automatically
CREATE OR REPLACE FUNCTION update_invitation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_invitation_timestamp
BEFORE UPDATE ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION update_invitation_timestamp();

-- Create indices for frequent queries
CREATE INDEX IF NOT EXISTS invitations_inviter_id_idx ON public.invitations(inviter_id);
CREATE INDEX IF NOT EXISTS invitations_invited_phone_idx ON public.invitations(invited_phone);
CREATE INDEX IF NOT EXISTS invitations_status_idx ON public.invitations(status);

-- Create Row Level Security (RLS) policies
ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

-- Policy to allow users to view their own invitations
CREATE POLICY view_own_invitations ON public.invitations
  FOR SELECT
  USING (inviter_id = auth.uid());

-- Policy to allow users to create invitations
CREATE POLICY create_invitations ON public.invitations
  FOR INSERT
  WITH CHECK (inviter_id = auth.uid());

-- Policy to allow users to update their own invitations
CREATE POLICY update_own_invitations ON public.invitations
  FOR UPDATE
  USING (inviter_id = auth.uid());

-- Grant access to authenticated users
GRANT ALL ON public.invitations TO authenticated;

-- This function will be used to check if a user has already invited someone
-- with a specific phone number
CREATE OR REPLACE FUNCTION public.has_invited_contact(phone_number TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  invitation_exists BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.invitations 
    WHERE inviter_id = auth.uid() 
    AND invited_phone = phone_number
  ) INTO invitation_exists;
  
  RETURN invitation_exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 