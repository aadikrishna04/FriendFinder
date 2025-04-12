-- Update the policy for selecting events to make open events visible to all authenticated users
DROP POLICY IF EXISTS "Users can view their own events and public events" ON public.events;
DROP POLICY IF EXISTS "Users can view their own events and open events" ON public.events;

CREATE POLICY "Users can view their own events and open events"
ON public.events
FOR SELECT
USING (
    host_id = auth.uid() OR
    (is_open = true AND auth.role() = 'authenticated')
);

-- Fix infinite recursion detected in events policy
-- This script fixes the 42P17 error: "infinite recursion detected in policy for relation \"events\""

-- Drop the problematic policies
DROP POLICY IF EXISTS "Users can read public events or events they are invited to" ON public.events;
DROP POLICY IF EXISTS "Event hosts can update their events" ON public.events;

-- Create a function to safely check event attendance without recursion
CREATE OR REPLACE FUNCTION public.user_is_event_attendee(event_id UUID, user_uuid UUID) 
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 
        FROM public.event_attendees
        WHERE event_attendees.event_id = $1
        AND event_attendees.user_id = $2
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the select policy using the helper function
CREATE POLICY "Users can read public events or events they are invited to"
    ON public.events
    FOR SELECT
    USING (
        is_open = true OR
        host_id = auth.uid() OR
        public.user_is_event_attendee(id, auth.uid())
    );

-- Recreate the update policy
CREATE POLICY "Event hosts can update their events"
    ON public.events
    FOR UPDATE
    USING (host_id = auth.uid())
    WITH CHECK (host_id = auth.uid());

-- Recreate the policy for the search_events_by_tags function
CREATE OR REPLACE FUNCTION search_events_by_tags(search_tags TEXT[])
RETURNS SETOF public.events AS $$
BEGIN
    RETURN QUERY
    SELECT e.*
    FROM public.events e
    WHERE e.tags && search_tags -- overlap operator
    AND (
        e.is_open = true OR
        e.host_id = auth.uid() OR
        public.user_is_event_attendee(e.id, auth.uid())
    )
    ORDER BY 
        array_length(ARRAY(
            SELECT unnest(e.tags)
            INTERSECT
            SELECT unnest(search_tags)
        ), 1) DESC,
        e.event_date;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER; 