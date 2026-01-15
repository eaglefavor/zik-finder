-- 1. Schema: Add pause duration column
ALTER TABLE public.lodges 
ADD COLUMN IF NOT EXISTS paused_promoted_duration INTERVAL DEFAULT NULL;

-- 2. RPC: Toggle Suspension with Timer Logic and Notifications
CREATE OR REPLACE FUNCTION toggle_lodge_suspension(
    p_lodge_id UUID,
    p_action TEXT, -- 'suspend' or 'unsuspend'
    p_reason TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lodge RECORD;
    v_landlord_id UUID;
    v_notification_msg TEXT;
BEGIN
    -- Authorization Check (Admin Only)
    IF NOT is_admin() THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Admin only');
    END IF;

    -- Fetch Lodge Details
    SELECT * INTO v_lodge FROM public.lodges WHERE id = p_lodge_id;
    IF v_lodge.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lodge not found');
    END IF;

    v_landlord_id := v_lodge.landlord_id;

    -- ACTION: SUSPEND
    IF p_action = 'suspend' THEN
        -- Check if already suspended
        IF v_lodge.status = 'suspended' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Lodge is already suspended');
        END IF;

        -- 1. Handle Promotion Timer
        IF v_lodge.promoted_until IS NOT NULL AND v_lodge.promoted_until > NOW() THEN
            UPDATE public.lodges 
            SET paused_promoted_duration = (promoted_until - NOW()),
                promoted_until = NULL,
                status = 'suspended'
            WHERE id = p_lodge_id;
        ELSE
            UPDATE public.lodges 
            SET status = 'suspended'
            WHERE id = p_lodge_id;
        END IF;

        -- 2. Send Notification
        v_notification_msg := 'Your lodge "' || v_lodge.title || '" has been suspended by an admin.';
        IF p_reason IS NOT NULL THEN
            v_notification_msg := v_notification_msg || ' Reason: ' || p_reason;
        END IF;
        
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (v_landlord_id, 'Listing Suspended ⚠️', v_notification_msg, 'error', '/');

        RETURN jsonb_build_object('success', true, 'status', 'suspended');

    -- ACTION: UNSUSPEND
    ELSIF p_action = 'unsuspend' THEN
        -- Check if really suspended
        IF v_lodge.status != 'suspended' THEN
            RETURN jsonb_build_object('success', false, 'message', 'Lodge is not suspended');
        END IF;

        -- 1. Handle Promotion Timer (Resume)
        IF v_lodge.paused_promoted_duration IS NOT NULL THEN
            UPDATE public.lodges 
            SET promoted_until = (NOW() + paused_promoted_duration),
                paused_promoted_duration = NULL,
                status = 'available'
            WHERE id = p_lodge_id;
        ELSE
            UPDATE public.lodges 
            SET status = 'available'
            WHERE id = p_lodge_id;
        END IF;

        -- 2. Send Notification
        INSERT INTO public.notifications (user_id, title, message, type, link)
        VALUES (
            v_landlord_id, 
            'Listing Restored ✅', 
            'Your lodge "' || v_lodge.title || '" has been re-activated. ' || 
            CASE WHEN v_lodge.paused_promoted_duration IS NOT NULL THEN 'Your promotion timer has resumed.' ELSE '' END,
            'success', 
            '/lodge/' || p_lodge_id
        );

        RETURN jsonb_build_object('success', true, 'status', 'available');

    ELSE
        RETURN jsonb_build_object('success', false, 'message', 'Invalid action');
    END IF;
END;
$$;