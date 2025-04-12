-- Check and add tags column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'events'
        AND column_name = 'tags'
    ) THEN
        ALTER TABLE public.events ADD COLUMN tags TEXT[] DEFAULT NULL;
        
        -- Create index on tags column for faster searches
        CREATE INDEX IF NOT EXISTS idx_events_tags ON public.events USING GIN (tags);
        
        RAISE NOTICE 'Added tags column to events table with GIN index';
    ELSE
        RAISE NOTICE 'Tags column already exists in events table';
    END IF;
END $$;

-- Check and add updated_at column
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'events'
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE public.events ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT now();
    END IF;
END $$;

-- Create or replace the timestamp update function
CREATE OR REPLACE FUNCTION update_modified_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop the trigger if it exists, then create it
DROP TRIGGER IF EXISTS set_timestamp ON public.events;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON public.events
FOR EACH ROW
EXECUTE PROCEDURE update_modified_column();

-- Update RLS policies to include tags
DROP POLICY IF EXISTS "Users can read public events or events they are invited to" ON public.events;
CREATE POLICY "Users can read public events or events they are invited to"
    ON public.events
    FOR SELECT
    USING (
        is_open = true OR
        host_id = auth.uid() OR
        id IN (
            SELECT event_id FROM public.event_attendees 
            WHERE user_id = auth.uid()
        )
    );

-- Ensure tags are included in the update policy
DROP POLICY IF EXISTS "Event hosts can update their events" ON public.events;
CREATE POLICY "Event hosts can update their events"
    ON public.events
    FOR UPDATE
    USING (host_id = auth.uid())
    WITH CHECK (host_id = auth.uid());

-- Add a function to search events by tags
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
        e.id IN (
            SELECT event_id FROM public.event_attendees 
            WHERE user_id = auth.uid()
        )
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