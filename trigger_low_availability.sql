-- Trigger: Low Availability Alert
-- Description: Notifies students who favorited a lodge when unit availability drops to <= 2.

CREATE OR REPLACE FUNCTION public.handle_low_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lodge_title TEXT;
    v_lodge_id UUID;
BEGIN
    -- Only trigger if available_units dropped (availability decreasing) AND is now between 1 and 2
    IF NEW.available_units < OLD.available_units AND NEW.available_units > 0 AND NEW.available_units <= 2 THEN
        
        -- Get Lodge Info
        SELECT title, id INTO v_lodge_title, v_lodge_id
        FROM public.lodges
        WHERE id = NEW.lodge_id;

        -- Insert notifications
        INSERT INTO public.notifications (user_id, title, message, type, link)
        SELECT 
            user_id,
            'Hurry! ⏳',
            'Only ' || NEW.available_units || ' room(s) left for the ' || NEW.name || ' at "' || v_lodge_title || '".',
            'warning',
            '/lodge/' || v_lodge_id
        FROM public.favorites
        WHERE lodge_id = v_lodge_id;
        
    END IF;

    RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS on_unit_availability_drop ON public.lodge_units;
CREATE TRIGGER on_unit_availability_drop
    AFTER UPDATE OF available_units ON public.lodge_units
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_low_availability();
