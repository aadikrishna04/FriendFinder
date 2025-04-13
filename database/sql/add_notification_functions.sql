-- Create a table to store notifications
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL, -- 'invitation_sent', 'invitation_accepted', etc.
  content JSONB NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create indices for notifications table
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON public.notifications(is_read);
CREATE INDEX IF NOT EXISTS notifications_created_at_idx ON public.notifications(created_at);

-- Enable RLS on notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own notifications
CREATE POLICY view_own_notifications ON public.notifications
  FOR SELECT
  USING (user_id = auth.uid());

-- Create policy for users to update their own notifications (e.g., marking as read)
CREATE POLICY update_own_notifications ON public.notifications
  FOR UPDATE
  USING (user_id = auth.uid());

-- Function to create an invitation notification
CREATE OR REPLACE FUNCTION public.create_invitation_notification()
RETURNS TRIGGER AS $$
BEGIN
  -- Create a notification for the inviter (confirmation)
  INSERT INTO public.notifications (
    user_id,
    type,
    content
  ) VALUES (
    NEW.inviter_id,
    'invitation_sent',
    jsonb_build_object(
      'invitation_id', NEW.id,
      'invited_name', NEW.invited_name,
      'invited_phone', NEW.invited_phone,
      'sent_at', NEW.created_at
    )
  );
  
  -- In a real-world scenario, we would also trigger a notification to the 
  -- invitee via SMS or other channels. This would typically be handled by 
  -- an external service or Edge Functions in Supabase.
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create notification when an invitation is created
CREATE TRIGGER invitation_notification_trigger
AFTER INSERT ON public.invitations
FOR EACH ROW
EXECUTE FUNCTION public.create_invitation_notification();

-- Function to mark invitation as accepted when a user signs up with an invited phone number
CREATE OR REPLACE FUNCTION public.check_and_update_invitation()
RETURNS TRIGGER AS $$
DECLARE
  invitation_record RECORD;
BEGIN
  -- Check if this phone number was invited
  SELECT * INTO invitation_record
  FROM public.invitations
  WHERE invited_phone = NEW.phone_number
  AND status = 'sent'
  LIMIT 1;
  
  -- If found, update the invitation status
  IF FOUND THEN
    -- Update invitation status
    UPDATE public.invitations
    SET status = 'accepted', updated_at = NOW()
    WHERE id = invitation_record.id;
    
    -- Create notification for the inviter
    INSERT INTO public.notifications (
      user_id,
      type,
      content
    ) VALUES (
      invitation_record.inviter_id,
      'invitation_accepted',
      jsonb_build_object(
        'invitation_id', invitation_record.id,
        'invited_name', invitation_record.invited_name,
        'accepted_at', NOW()
      )
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to check invitations when a new user profile is created
CREATE TRIGGER check_invitation_on_user_created
AFTER INSERT ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.check_and_update_invitation();

-- Function to get unread notification count for a user
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS INTEGER AS $$
DECLARE
  notification_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO notification_count
  FROM public.notifications
  WHERE user_id = auth.uid()
  AND is_read = FALSE;
  
  RETURN notification_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant access to authenticated users
GRANT ALL ON public.notifications TO authenticated; 