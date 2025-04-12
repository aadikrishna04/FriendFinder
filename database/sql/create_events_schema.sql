-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    host_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    event_date TIMESTAMP WITH TIME ZONE NOT NULL,
    is_open BOOLEAN DEFAULT true,
    image_url TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    tags TEXT[] DEFAULT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create event attendees table
CREATE TABLE IF NOT EXISTS public.event_attendees (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- Set up Row Level Security (RLS)

-- Enable RLS on events table
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

-- Policy for selecting events:
-- Users can view events if:
-- 1. They are the host
-- 2. The event is open (is_open = true)
CREATE POLICY "Users can view their own events and public events"
    ON public.events
    FOR SELECT
    USING (
        host_id = auth.uid() OR
        is_open = true
    );

-- Policy for inserting events (only authenticated users can create events)
CREATE POLICY "Users can create their own events"
    ON public.events
    FOR INSERT
    WITH CHECK (host_id = auth.uid());

-- Policy for updating events (only the host can update their events)
CREATE POLICY "Users can update their own events"
    ON public.events
    FOR UPDATE
    USING (host_id = auth.uid());

-- Policy for deleting events (only the host can delete their events)
CREATE POLICY "Users can delete their own events"
    ON public.events
    FOR DELETE
    USING (host_id = auth.uid());

-- Enable RLS on event_attendees table
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Policy for selecting attendees:
-- Users can see who is attending an event if:
-- 1. They are attending the event themselves
-- 2. They are the host of the event
CREATE POLICY "Users can view attendees of events they're involved with"
    ON public.event_attendees
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        event_id IN (
            SELECT id FROM public.events WHERE host_id = auth.uid()
        )
    );

-- Policy for inserting attendance:
-- Users can mark themselves as attending but not others
CREATE POLICY "Users can attend events"
    ON public.event_attendees
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- Policy for deleting attendance:
-- Users can remove their own attendance
CREATE POLICY "Users can remove their own attendance"
    ON public.event_attendees
    FOR DELETE
    USING (user_id = auth.uid());

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policy for event images
CREATE POLICY "Public can read event images"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'events');

CREATE POLICY "Users can upload event images"
    ON storage.objects
    FOR INSERT
    WITH CHECK (
        bucket_id = 'events' AND
        auth.role() = 'authenticated'
    );

CREATE POLICY "Event creators can update their images"
    ON storage.objects
    FOR UPDATE
    USING (
        bucket_id = 'events' AND
        auth.uid() = (
            SELECT host_id FROM public.events
            WHERE image_url LIKE '%' || name
            LIMIT 1
        )
    );

-- Trigger to add a user to event_attendees when they create an event
CREATE OR REPLACE FUNCTION public.add_host_to_attendees()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.event_attendees (event_id, user_id)
    VALUES (NEW.id, NEW.host_id)
    ON CONFLICT (event_id, user_id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER add_host_after_event_creation
AFTER INSERT ON public.events
FOR EACH ROW
EXECUTE FUNCTION public.add_host_to_attendees();

-- Auto-update the updated_at timestamp when an event is updated
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column(); 