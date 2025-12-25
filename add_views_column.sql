-- Add views column to lodges table
ALTER TABLE public.lodges ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Create RPC function to increment views safely
CREATE OR REPLACE FUNCTION increment_lodge_views(lodge_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE public.lodges
  SET views = views + 1
  WHERE id = lodge_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
