-- Fix: Add missing updated_at column to lodges table for Delta Sync

ALTER TABLE lodges 
ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone DEFAULT now();

-- Create function to auto-update updated_at if it doesn't exist
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for lodges
DROP TRIGGER IF EXISTS update_lodges_updated_at ON lodges;
CREATE TRIGGER update_lodges_updated_at
    BEFORE UPDATE ON lodges
    FOR EACH ROW
    EXECUTE PROCEDURE update_updated_at_column();
