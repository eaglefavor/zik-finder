-- Admin Broadcast Function
-- Allows sending a notification to many users at once.

BEGIN;

CREATE OR REPLACE FUNCTION public.broadcast_notification(
    p_title TEXT, 
    p_message TEXT, 
    p_type TEXT DEFAULT 'info', 
    p_target_role TEXT DEFAULT 'all'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT id, p_title, p_message, p_type
    FROM public.profiles
    WHERE (p_target_role = 'all' OR role = p_target_role);
END;
$$;

COMMIT;
