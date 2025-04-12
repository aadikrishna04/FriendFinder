-- Add the tags column to the events table if it doesn't exist
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
    END IF;
END $$; 