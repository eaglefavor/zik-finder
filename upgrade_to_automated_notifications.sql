-- UPGRADE: Automated Notification Triggers
-- This script moves notification logic from the Browser to the Database for 100% reliability.

BEGIN;

-- 1. Milestone Notification Function
CREATE OR REPLACE FUNCTION public.fn_notify_on_view_milestone()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    milestones INTEGER[] := ARRAY[10, 50, 100, 250, 500, 1000];
BEGIN
    -- Check if the new view count is a milestone
    IF NEW.views IS DISTINCT FROM OLD.views AND NEW.views = ANY(milestones) THEN
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            NEW.landlord_id,
            '🎉 Lodge View Milestone!',
            'Your lodge "' || NEW.title || '" has reached ' || NEW.views || ' views! Keep up the good work.',
            'success',
            '/lodge/' || NEW.id
        );
    END IF;
    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Safeguard to ensure lodge update doesn't fail if notification fails
    RETURN NEW;
END;
$$;

-- 2. New Match Notification Function
CREATE OR REPLACE FUNCTION public.fn_notify_on_new_lodge_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Find students with matching requests
    -- Logic: Matches specific location OR 'Any Location'
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT 
        r.student_id,
        'New Lodge Match! 🏠',
        'A new lodge in ' || NEW.location || ' was just posted that matches your request.',
        'success',
        '/lodge/' || NEW.id
    FROM public.requests r
    WHERE 
        r.location = 'Any Location' OR 
        NEW.location ILIKE '%' || split_part(r.location, ' (', 1) || '%' OR
        r.location ILIKE '%' || NEW.location || '%';

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RETURN NEW;
END;
$$;

-- 3. Attach Triggers
DROP TRIGGER IF EXISTS tr_notify_milestone ON public.lodges;
CREATE TRIGGER tr_notify_milestone
    AFTER UPDATE OF views ON public.lodges
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_on_view_milestone();

DROP TRIGGER IF EXISTS tr_notify_match ON public.lodges;
CREATE TRIGGER tr_notify_match
    AFTER INSERT ON public.lodges
    FOR EACH ROW
    EXECUTE FUNCTION public.fn_notify_on_new_lodge_match();

COMMIT;
