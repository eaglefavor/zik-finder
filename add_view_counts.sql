-- Create a log table for lodge views to track performance over time
CREATE TABLE IF NOT EXISTS public.lodge_views_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lodge_id UUID NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for performance on date filtering
CREATE INDEX IF NOT EXISTS idx_lodge_views_log_created_at ON public.lodge_views_log(created_at);
CREATE INDEX IF NOT EXISTS idx_lodge_views_log_lodge_id ON public.lodge_views_log(lodge_id);

-- Update the increment function to also log the timestamped view
CREATE OR REPLACE FUNCTION increment_lodge_view(p_lodge_id UUID, p_viewer_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Update the main counter on the lodge (for fast retrieval)
    UPDATE public.lodges
    SET views = COALESCE(views, 0) + 1
    WHERE id = p_lodge_id;

    -- 2. Log the individual view with timestamp
    INSERT INTO public.lodge_views_log (lodge_id, viewer_id)
    VALUES (p_lodge_id, p_viewer_id);
END;
$$;