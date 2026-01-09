-- Trigger: Price Drop Notification
-- Description: Notifies students who favorited a lodge when its price drops.

CREATE OR REPLACE FUNCTION public.handle_price_drop()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old_price INTEGER;
    v_new_price INTEGER;
    v_title TEXT;
    v_lodge_id UUID;
    v_notif_count INTEGER;
BEGIN
    v_old_price := OLD.price;
    v_new_price := NEW.price;
    v_title := NEW.title;
    v_lodge_id := NEW.id;

    -- Only proceed if price decreased
    IF v_new_price < v_old_price THEN
        -- Insert notifications for all users who favorited this lodge
        INSERT INTO public.notifications (user_id, title, message, type, link)
        SELECT 
            user_id,
            'Price Drop! 💸',
            'The rent for "' || v_title || '" has been reduced to ₦' || to_char(v_new_price, 'FM999,999,999') || '.',
            'info',
            '/lodge/' || v_lodge_id
        FROM public.favorites
        WHERE lodge_id = v_lodge_id;
        
        GET DIAGNOSTICS v_notif_count = ROW_COUNT;
        RAISE NOTICE 'Sent % price drop notifications for lodge %', v_notif_count, v_lodge_id;
    END IF;

    RETURN NEW;
END;
$$;

-- Create Trigger
DROP TRIGGER IF EXISTS on_lodge_price_drop ON public.lodges;
CREATE TRIGGER on_lodge_price_drop
    AFTER UPDATE OF price ON public.lodges
    FOR EACH ROW
    WHEN (OLD.price > NEW.price)
    EXECUTE FUNCTION public.handle_price_drop();
