-- 1. NOTIFICATION ON UNLOCK (Modify existing logic or new trigger)
-- We will modify the unlock_lead function directly to ensure it happens atomically.

CREATE OR REPLACE FUNCTION unlock_lead(p_lead_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_lead RECORD;
    v_wallet RECORD;
    v_cost INT;
    v_lodge_price NUMERIC;
    v_landlord_id UUID;
    v_lodge_title TEXT;
BEGIN
    v_landlord_id := auth.uid();

    -- 1. Fetch Lead & Validation
    SELECT l.*, lo.price as lodge_price, lo.title as lodge_title 
    INTO v_lead 
    FROM leads l
    JOIN lodges lo ON l.lodge_id = lo.id
    WHERE l.id = p_lead_id AND l.landlord_id = v_landlord_id;

    IF v_lead.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lead not found');
    END IF;

    IF v_lead.status = 'unlocked' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Lead already unlocked');
    END IF;

    -- 2. Determine Cost
    v_lodge_price := v_lead.lodge_price;
    IF v_lodge_price >= 700000 THEN v_cost := 20;
    ELSIF v_lodge_price >= 300000 THEN v_cost := 15;
    ELSE v_cost := 10;
    END IF;

    -- 3. Check Wallet Balance
    SELECT * INTO v_wallet FROM landlord_wallets WHERE landlord_id = v_landlord_id;
    
    IF v_wallet.balance < v_cost THEN
        RETURN jsonb_build_object('success', false, 'message', 'Insufficient Z-Credits');
    END IF;

    -- 4. Execute Transaction (Deduct & Update)
    UPDATE landlord_wallets 
    SET balance = balance - v_cost 
    WHERE landlord_id = v_landlord_id;

    UPDATE leads 
    SET status = 'unlocked', 
        unlocked_at = NOW(),
        unlock_cost = v_cost
    WHERE id = p_lead_id;

    -- 5. NOTIFY STUDENT (New Addition)
    INSERT INTO notifications (user_id, title, message, type, link)
    VALUES (
        v_lead.student_id,
        'Chat Request Accepted! 💬',
        'The landlord of "' || v_lead.lodge_title || '" has accepted your request. You can now view their contact details.',
        'success',
        '/lodge/' || v_lead.lodge_id
    );

    RETURN jsonb_build_object('success', true, 'remaining_balance', v_wallet.balance - v_cost);
END;
$$;

-- 2. REVIEWS SYSTEM UPGRADE
-- Add support for replies and photos in reviews

-- Add image_urls to reviews if not exists
ALTER TABLE public.reviews 
ADD COLUMN IF NOT EXISTS image_urls TEXT[] DEFAULT '{}';

-- Create Review Replies Table
CREATE TABLE IF NOT EXISTS public.review_replies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    review_id UUID REFERENCES public.reviews(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Replies
ALTER TABLE public.review_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view replies" 
ON public.review_replies FOR SELECT 
USING (true);

CREATE POLICY "Authenticated users can reply" 
ON public.review_replies FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own replies" 
ON public.review_replies FOR DELETE 
USING (auth.uid() = user_id);
