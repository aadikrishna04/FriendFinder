-- Create a table for event invitations
CREATE TABLE IF NOT EXISTS public.event_invitations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_id UUID REFERENCES public.events(id) ON DELETE CASCADE,
  inviter_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  invitee_phone TEXT,
  invitee_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'accepted', 'declined'
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  
  -- Add a unique constraint to prevent duplicate invitations
  UNIQUE (event_id, invitee_id),
  UNIQUE (event_id, invitee_phone),
  UNIQUE (event_id, invitee_email),
  -- Add a constraint to ensure only one invitee identifier is provided
  CONSTRAINT require_invitee_info CHECK (
    (invitee_id IS NOT NULL AND invitee_phone IS NULL AND invitee_email IS NULL) OR
    (invitee_id IS NULL AND invitee_phone IS NOT NULL AND invitee_email IS NULL) OR
    (invitee_id IS NULL AND invitee_phone IS NULL AND invitee_email IS NOT NULL)
  )
);

-- Create indices for frequent queries
CREATE INDEX IF NOT EXISTS event_invitations_event_id_idx ON public.event_invitations(event_id);
CREATE INDEX IF NOT EXISTS event_invitations_inviter_id_idx ON public.event_invitations(inviter_id);
CREATE INDEX IF NOT EXISTS event_invitations_invitee_id_idx ON public.event_invitations(invitee_id);
CREATE INDEX IF NOT EXISTS event_invitations_invitee_phone_idx ON public.event_invitations(invitee_phone);
CREATE INDEX IF NOT EXISTS event_invitations_invitee_email_idx ON public.event_invitations(invitee_email);
CREATE INDEX IF NOT EXISTS event_invitations_status_idx ON public.event_invitations(status);

-- Enable Row Level Security
ALTER TABLE public.event_invitations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view invitations for events they created
CREATE POLICY view_own_event_invitations ON public.event_invitations
  FOR SELECT
  USING (
    inviter_id = auth.uid() OR 
    invitee_id = auth.uid() OR
    event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid())
  );

-- Users can create invitations for events they created
CREATE POLICY create_event_invitations ON public.event_invitations
  FOR INSERT
  WITH CHECK (
    inviter_id = auth.uid() AND
    event_id IN (SELECT id FROM public.events WHERE host_id = auth.uid())
  );

-- Users can update their own invitations (e.g., accept/decline)
CREATE POLICY update_own_invitations ON public.event_invitations
  FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (
    invitee_id = auth.uid() AND
    (
      -- Only allow updating the status field
      event_id = (SELECT event_id FROM public.event_invitations WHERE id = id) AND
      inviter_id = (SELECT inviter_id FROM public.event_invitations WHERE id = id) AND
      invitee_id = (SELECT invitee_id FROM public.event_invitations WHERE id = id)
    )
  );

-- Function to update the modified timestamp
CREATE OR REPLACE FUNCTION update_event_invitation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to update the timestamp on update
CREATE TRIGGER update_event_invitation_timestamp
BEFORE UPDATE ON public.event_invitations
FOR EACH ROW
EXECUTE FUNCTION update_event_invitation_timestamp();

-- Function to create a notification when an event invitation is created
CREATE OR REPLACE FUNCTION create_event_invitation_notification()
RETURNS TRIGGER AS $$
DECLARE
  event_data RECORD;
  inviter_name TEXT;
BEGIN
  -- Skip notification if it's a phone-only invitation (non-registered user)
  IF NEW.invitee_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get event data
  SELECT title, description, event_date 
  INTO event_data
  FROM public.events
  WHERE id = NEW.event_id;
  
  -- Get inviter name
  SELECT name 
  INTO inviter_name
  FROM public.users
  WHERE id = NEW.inviter_id;
  
  -- Create notification for the invitee
  INSERT INTO public.notifications (
    user_id,
    type,
    content,
    is_read
  ) VALUES (
    NEW.invitee_id,
    'event_invitation',
    jsonb_build_object(
      'event_id', NEW.event_id,
      'event_title', event_data.title,
      'event_date', event_data.event_date,
      'sender_id', NEW.inviter_id,
      'sender_name', inviter_name,
      'invitation_id', NEW.id
    ),
    FALSE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification when an invitation is created
CREATE TRIGGER event_invitation_notification_trigger
AFTER INSERT ON public.event_invitations
FOR EACH ROW
EXECUTE FUNCTION create_event_invitation_notification();

-- Function to create a notification when an event invitation status is updated
CREATE OR REPLACE FUNCTION update_event_invitation_notification()
RETURNS TRIGGER AS $$
DECLARE
  event_data RECORD;
  invitee_name TEXT;
BEGIN
  -- Only create notification if status has changed
  IF OLD.status = NEW.status THEN
    RETURN NEW;
  END IF;
  
  -- Get event data
  SELECT title, event_date 
  INTO event_data
  FROM public.events
  WHERE id = NEW.event_id;
  
  -- Get invitee name
  SELECT name 
  INTO invitee_name
  FROM public.users
  WHERE id = NEW.invitee_id;
  
  -- Create notification for the event host/inviter
  INSERT INTO public.notifications (
    user_id,
    type,
    content,
    is_read
  ) VALUES (
    NEW.inviter_id,
    'event_invitation_response',
    jsonb_build_object(
      'event_id', NEW.event_id,
      'event_title', event_data.title,
      'event_date', event_data.event_date,
      'responder_id', NEW.invitee_id,
      'responder_name', invitee_name,
      'status', NEW.status,
      'invitation_id', NEW.id
    ),
    FALSE
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification when an invitation status is updated
CREATE TRIGGER event_invitation_update_trigger
AFTER UPDATE ON public.event_invitations
FOR EACH ROW
EXECUTE FUNCTION update_event_invitation_notification();

-- Grant access to authenticated users
GRANT ALL ON public.event_invitations TO authenticated; 