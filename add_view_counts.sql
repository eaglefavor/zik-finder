-- Add views column to lodges table
ALTER TABLE public.lodges ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- Create RPC function to safely increment views
CREATE OR REPLACE FUNCTION public.increment_lodge_views(row_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.lodges
  SET views = views + 1
  WHERE id = row_id;
END;
$$;
