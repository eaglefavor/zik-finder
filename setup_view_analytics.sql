-- ==============================================================================
-- SETUP VIEW ANALYTICS (Run this entire script to fix the "relation does not exist" error)
-- ==============================================================================

-- 1. Create the log table (IF NOT EXISTS prevents errors if it was partially run)
CREATE TABLE IF NOT EXISTS public.lodge_views_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lodge_id UUID NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
    viewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Create performance indexes
CREATE INDEX IF NOT EXISTS idx_lodge_views_log_created_at ON public.lodge_views_log(created_at);
CREATE INDEX IF NOT EXISTS idx_lodge_views_log_lodge_id ON public.lodge_views_log(lodge_id);

-- 3. Update/Create the increment function to log views
CREATE OR REPLACE FUNCTION increment_lodge_view(p_lodge_id UUID, p_viewer_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Update the main counter on the lodge (for fast retrieval)
    UPDATE public.lodges
    SET views = COALESCE(views, 0) + 1
    WHERE id = p_lodge_id;

    -- Log the individual view with timestamp
    INSERT INTO public.lodge_views_log (lodge_id, viewer_id)
    VALUES (p_lodge_id, p_viewer_id);
END;
$$;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.lodge_views_log ENABLE ROW LEVEL SECURITY;

-- 5. Add Policies (Drop existing first to allow re-running script)
DROP POLICY IF EXISTS "Landlords can view logs for their own lodges" ON public.lodge_views_log;
DROP POLICY IF EXISTS "Admins can view all logs" ON public.lodge_views_log;

-- Policy: Landlords can view logs for their own lodges
CREATE POLICY "Landlords can view logs for their own lodges"
ON public.lodge_views_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.lodges
        WHERE id = lodge_views_log.lodge_id
        AND landlord_id = auth.uid()
    )
);

-- Policy: Admins can view all logs
CREATE POLICY "Admins can view all logs"
ON public.lodge_views_log FOR SELECT
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
