-- Update function to safely handle notification errors without rolling back view count
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
            BEGIN
                INSERT INTO public.notifications (user_id, title, message, type, link)
                VALUES (
                    NEW.landlord_id,
                    '🎉 Lodge View Milestone!',
                    'Your lodge "' || NEW.title || '" has reached ' || NEW.views || ' views! Keep up the good work.',
                    'success',
                    '/lodge/' || NEW.id
                );
            EXCEPTION WHEN OTHERS THEN
                -- Ignore errors during notification to prevent view count rollback
                RAISE WARNING 'Failed to send view milestone notification: %', SQLERRM;
            END;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
