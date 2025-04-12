-- Add the updated_at column to the events table if it doesn't exist
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
        
        -- Create the function to update the timestamp
        CREATE OR REPLACE FUNCTION update_modified_column()
        RETURNS TRIGGER AS $BODY$
        BEGIN
            NEW.updated_at = now();
            RETURN NEW;
        END;
        $BODY$ LANGUAGE plpgsql;
        
        -- Create the trigger to call the function
        DROP TRIGGER IF EXISTS set_timestamp ON public.events;
        CREATE TRIGGER set_timestamp
        BEFORE UPDATE ON public.events
        FOR EACH ROW
        EXECUTE PROCEDURE update_modified_column();
    END IF;
END $$; 