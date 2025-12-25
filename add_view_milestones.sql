-- Function to check for view milestones and notify landlord
CREATE OR REPLACE FUNCTION notify_view_milestones()
RETURNS TRIGGER AS $$
DECLARE
    milestone INTEGER;
    milestones INTEGER[] := ARRAY[10, 50, 100, 200, 500, 1000, 2000, 5000, 10000];
    should_notify BOOLEAN := FALSE;
BEGIN
    -- Only check if views have increased
    IF NEW.views > OLD.views THEN
        FOREACH milestone IN ARRAY milestones
        LOOP
            -- Check if we just crossed a milestone
            IF OLD.views < milestone AND NEW.views >= milestone THEN
                should_notify := TRUE;
                EXIT; -- Stop checking once we find the crossed milestone
            END IF;
        END LOOP;

        IF should_notify THEN
            INSERT INTO public.notifications (user_id, title, message, type, link)
            VALUES (
                NEW.landlord_id,
                '🎉 Lodge View Milestone!',
                'Your lodge "' || NEW.title || '" has reached ' || NEW.views || ' views! Keep up the good work.',
                'success',
                '/lodge/' || NEW.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create Trigger
DROP TRIGGER IF EXISTS check_view_milestones ON public.lodges;
CREATE TRIGGER check_view_milestones
AFTER UPDATE OF views ON public.lodges
FOR EACH ROW
EXECUTE FUNCTION notify_view_milestones();
