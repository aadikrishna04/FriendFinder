-- Add start_time and end_time columns if they don't exist
DO $$
BEGIN
    -- Add start_time column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'events'
        AND column_name = 'start_time'
    ) THEN
        ALTER TABLE public.events ADD COLUMN start_time TIME DEFAULT NULL;
    END IF;

    -- Add end_time column
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
        AND table_name = 'events'
        AND column_name = 'end_time'
    ) THEN
        ALTER TABLE public.events ADD COLUMN end_time TIME DEFAULT NULL;
    END IF;
END $$; 