-- Create event_groups table for linking events to groups
CREATE TABLE IF NOT EXISTS public.event_groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
  group_id UUID REFERENCES public.groups(id) ON DELETE CASCADE NOT NULL,
  invited_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL,
  
  -- Add a unique constraint to prevent duplicate invitations
  UNIQUE (event_id, group_id)
);

-- Enable Row Level Security
ALTER TABLE public.event_groups ENABLE ROW LEVEL SECURITY;

-- Create indices for better performance
CREATE INDEX IF NOT EXISTS idx_event_groups_event_id ON public.event_groups(event_id);
CREATE INDEX IF NOT EXISTS idx_event_groups_group_id ON public.event_groups(group_id);
CREATE INDEX IF NOT EXISTS idx_event_groups_invited_by ON public.event_groups(invited_by);

-- Add RLS policies to the event_groups table
-- Users can view event groups they have access to
CREATE POLICY view_event_groups ON public.event_groups
  FOR SELECT
  USING (
    -- Event host can view
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_groups.event_id
      AND events.host_id = auth.uid()
    )
    OR
    -- Group member can view
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = event_groups.group_id
      AND group_members.user_id = auth.uid()
    )
    OR
    -- Event attendee can view
    EXISTS (
      SELECT 1 FROM public.event_attendees
      WHERE event_attendees.event_id = event_groups.event_id
      AND event_attendees.user_id = auth.uid()
    )
  );

-- Users can insert (invite groups to events)
CREATE POLICY insert_event_groups ON public.event_groups
  FOR INSERT
  WITH CHECK (
    -- Event host can invite any group
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_groups.event_id
      AND events.host_id = auth.uid()
    )
    AND
    -- The user must be a member of the group
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = event_groups.group_id
      AND group_members.user_id = auth.uid()
    )
  );

-- Users can delete (remove groups from events)
CREATE POLICY delete_event_groups ON public.event_groups
  FOR DELETE
  USING (
    -- Event host can remove any group
    EXISTS (
      SELECT 1 FROM public.events
      WHERE events.id = event_groups.event_id
      AND events.host_id = auth.uid()
    )
    OR
    -- Group owner can remove their group
    EXISTS (
      SELECT 1 FROM public.group_members
      WHERE group_members.group_id = event_groups.group_id
      AND group_members.user_id = auth.uid()
      AND group_members.is_owner = true
    )
  );

-- Grant access to authenticated users
GRANT ALL ON public.event_groups TO authenticated;

-- Create function to automatically create invitations for group members
CREATE OR REPLACE FUNCTION public.add_group_members_to_event()
RETURNS TRIGGER AS $$
BEGIN
  -- When a group is invited to an event, create invitations for all group members
  INSERT INTO public.event_invitations (event_id, inviter_id, invitee_id, status)
  SELECT 
    NEW.event_id, 
    NEW.invited_by, 
    user_id,
    'pending'
  FROM public.group_members
  WHERE group_id = NEW.group_id
  ON CONFLICT (event_id, invitee_id) DO NOTHING;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger to add group members as event attendees
CREATE TRIGGER add_group_members_to_event_trigger
AFTER INSERT ON public.event_groups
FOR EACH ROW
EXECUTE FUNCTION public.add_group_members_to_event();
