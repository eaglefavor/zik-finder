-- Enable RLS on the views log table
ALTER TABLE public.lodge_views_log ENABLE ROW LEVEL SECURITY;

-- Policy: Landlords can view logs for their own lodges
-- This is required for the "View Growth" calculation on the dashboard
CREATE POLICY "Landlords can view logs for their own lodges"
ON public.lodge_views_log FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.lodges
        WHERE id = lodge_views_log.lodge_id
        AND landlord_id = auth.uid()
    )
);

-- Policy: Anyone can insert via the RPC function (handled by SECURITY DEFINER), 
-- but we don't need a direct INSERT policy if we only use the RPC.
-- However, if we wanted to allow direct inserts (not recommended), we would add one.
-- Since we use RPC, we just need to ensure the RPC works (which it does).

-- Optional: Allow admins to view all logs
CREATE POLICY "Admins can view all logs"
ON public.lodge_views_log FOR SELECT
USING (
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
