-- 021_robust_view_counting.sql
-- Upgrades the view counting logic to filter spam and own-views

CREATE OR REPLACE FUNCTION increment_lodge_view(p_lodge_id UUID, p_viewer_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_landlord_id UUID;
    v_last_view_time TIMESTAMP WITH TIME ZONE;
BEGIN
    -- 1. Get the landlord ID to check ownership
    SELECT landlord_id INTO v_landlord_id FROM public.lodges WHERE id = p_lodge_id;

    -- 2. Owner Exclusion: Exit immediately if the viewer is the landlord
    -- We don't want to count the landlord checking their own listing
    IF p_viewer_id IS NOT NULL AND p_viewer_id = v_landlord_id THEN
        RETURN;
    END IF;

    -- 3. Deduping (Logged-in users): Check if they viewed this lodge in the last 24 hours
    IF p_viewer_id IS NOT NULL THEN
        SELECT created_at INTO v_last_view_time
        FROM public.lodge_views_log
        WHERE lodge_id = p_lodge_id AND viewer_id = p_viewer_id
        ORDER BY created_at DESC
        LIMIT 1;

        -- If a view exists within the last 24 hours, skip incrementing
        IF v_last_view_time IS NOT NULL AND v_last_view_time > (NOW() - INTERVAL '24 hours') THEN
            RETURN;
        END IF;
    END IF;

    -- 4. Update the main counter
    -- Uses COALESCE to handle potential NULLs in legacy data
    UPDATE public.lodges
    SET views = COALESCE(views, 0) + 1
    WHERE id = p_lodge_id;

    -- 5. Log the individual view
    INSERT INTO public.lodge_views_log (lodge_id, viewer_id)
    VALUES (p_lodge_id, p_viewer_id);
END;
$$;
