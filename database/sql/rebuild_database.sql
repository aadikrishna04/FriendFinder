-- COMPLETE DATABASE REBUILD FOR FRIENDFINDER
-- This script completely rebuilds the database based on the schema diagram

-- Enable UUID extension if not enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create events table
CREATE TABLE IF NOT EXISTS public.events (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    host_id UUID REFERENCES auth.users(id) NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    location TEXT NOT NULL,
    event_date TIMESTAMPTZ NOT NULL,
    is_open BOOLEAN DEFAULT true,
    image_url TEXT,
    latitude FLOAT8,
    longitude FLOAT8,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    tags TEXT[],
    start_time TIME,
    end_time TIME
);

-- Create users table that mirrors auth.users
CREATE TABLE IF NOT EXISTS public.users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    email TEXT,
    avatar_url TEXT,
    calendar JSONB,
    phone_number TEXT,
    resume TEXT,
    tags JSONB
);

-- Create event_attendees table
CREATE TABLE IF NOT EXISTS public.event_attendees (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    event_id UUID REFERENCES public.events(id) ON DELETE CASCADE NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    UNIQUE (event_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;

-- Create simple policies to avoid infinite recursion
-- Events policies
CREATE POLICY "Users can view their own events and open events"
    ON public.events
    FOR SELECT
    USING (
        host_id = auth.uid() OR
        is_open = true
    );

CREATE POLICY "Users can create their own events"
    ON public.events
    FOR INSERT
    WITH CHECK (host_id = auth.uid());

CREATE POLICY "Users can update their own events"
    ON public.events
    FOR UPDATE
    USING (host_id = auth.uid());

CREATE POLICY "Users can delete their own events"
    ON public.events
    FOR DELETE
    USING (host_id = auth.uid());

-- Users policies
CREATE POLICY "Anyone can view users"
    ON public.users
    FOR SELECT
    USING (true);

CREATE POLICY "Users can update their own profile"
    ON public.users
    FOR UPDATE
    USING (id = auth.uid());

-- Event attendees policies
CREATE POLICY "Simple attendees read policy"
    ON public.event_attendees
    FOR SELECT
    USING (
        user_id = auth.uid() OR
        event_id IN (
            SELECT id FROM public.events WHERE host_id = auth.uid()
        )
    );

CREATE POLICY "Users can attend events"
    ON public.event_attendees
    FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can remove their own attendance"
    ON public.event_attendees
    FOR DELETE
    USING (user_id = auth.uid());

-- Create storage bucket for event images
INSERT INTO storage.buckets (id, name, public) 
VALUES ('events', 'events', true)
ON CONFLICT (id) DO NOTHING;

-- Set up storage policies
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

-- Create a trigger to sync auth.users to public.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.users (id, email)
    VALUES (NEW.id, NEW.email)
    ON CONFLICT (id) DO NOTHING;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_user(); 