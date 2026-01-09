-- Trigger: Request Matching
-- Description: Notifies landlords when a new student request matches their lodge location.

CREATE OR REPLACE FUNCTION public.handle_new_request_match()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_match_location TEXT;
BEGIN
    -- Extract primary location (e.g. "Ifite" from "Ifite (School Gate)")
    v_match_location := split_part(NEW.location, ' (', 1);
    
    -- If "Any Location", we might not want to spam EVERYONE, or maybe we do? 
    -- For now, let's skip "Any Location" to avoid spam, or handle it differently.
    -- Assuming we only notify for specific location matches for relevance.
    IF v_match_location = 'Any Location' OR v_match_location IS NULL THEN
        RETURN NEW;
    END IF;

    -- Insert notifications for landlords who have lodges in this location
    INSERT INTO public.notifications (user_id, title, message, type, link)
    SELECT DISTINCT
        l.landlord_id,
        'New Student Request! 🎯',
        'A student is looking for a lodge in ' || v_match_location || '. Check the Market to see if you have a match!',
        'info',
        '/market'
    FROM public.lodges l
    WHERE l.location LIKE (v_match_location || '%')
      AND l.status = 'available';

    RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS on_request_created ON public.requests;
CREATE TRIGGER on_request_created
    AFTER INSERT ON public.requests
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_request_match();
