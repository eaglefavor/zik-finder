-- ==========================================
-- ZIPS 4.0: UNLOCK LOGIC (PHASE 3)
-- ==========================================

-- 1. Helper: Calculate Lead Cost
CREATE OR REPLACE FUNCTION get_lead_cost(p_amount NUMERIC)
RETURNS INT
LANGUAGE plpgsql
IMMUTABLE
AS $$
BEGIN
  IF p_amount >= 700000 THEN
    RETURN 20; -- Premium
  ELSIF p_amount >= 300000 THEN
    RETURN 15; -- High Value
  ELSE
    RETURN 10; -- Standard
  END IF;
END;
$$;

-- 2. RPC: Unlock a Lead (Inbound)
-- Called when a Landlord pays credits to reveal contact info for an existing INBOUND lead
CREATE OR REPLACE FUNCTION unlock_lead(
  p_lead_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_lead RECORD;
  v_landlord_id UUID;
  v_wallet_balance INT;
  v_cost INT;
  v_price_basis NUMERIC;
BEGIN
  v_landlord_id := auth.uid();

  -- 1. Fetch Lead
  SELECT * INTO v_lead FROM public.leads WHERE id = p_lead_id;
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead not found';
  END IF;

  -- 2. Validate Ownership (Must be the landlord involved)
  IF v_lead.landlord_id != v_landlord_id THEN
    RAISE EXCEPTION 'Unauthorized: You are not the recipient of this lead';
  END IF;

  -- 3. Check if already unlocked
  IF v_lead.status = 'unlocked' THEN
    RETURN jsonb_build_object('success', true, 'message', 'Already unlocked', 'cost', 0);
  END IF;

  -- 4. Determine Cost
  IF v_lead.type = 'inbound' THEN
    -- Cost based on Lodge Price
    SELECT price INTO v_price_basis FROM public.lodges WHERE id = v_lead.lodge_id;
  END IF;

  v_cost := get_lead_cost(COALESCE(v_price_basis, 0));

  -- 5. Check Wallet Balance
  SELECT balance INTO v_wallet_balance FROM public.landlord_wallets WHERE landlord_id = v_landlord_id;
  
  IF v_wallet_balance IS NULL OR v_wallet_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient Z-Credits. Required: %, Balance: %', v_cost, COALESCE(v_wallet_balance, 0);
  END IF;

  -- 6. Execute Unlock (Atomic)
  -- Deduct Credits
  UPDATE public.landlord_wallets 
  SET balance = balance - v_cost, 
      z_score = LEAST(100, z_score + 2) -- Bonus for activity
  WHERE landlord_id = v_landlord_id;

  -- Log Transaction
  INSERT INTO public.credit_transactions (landlord_id, amount, type, reference_id, description)
  VALUES (v_landlord_id, -v_cost, 'unlock_lead', p_lead_id, 'Unlocked lead contact');

  -- Update Lead Status
  UPDATE public.leads 
  SET status = 'unlocked', 
      unlocked_at = NOW(), 
      unlock_cost = v_cost 
  WHERE id = p_lead_id;

  RETURN jsonb_build_object('success', true, 'cost', v_cost, 'remaining_balance', v_wallet_balance - v_cost);
END;
$$;

-- 3. RPC: Create Inbound Lead (Student clicks "Request Chat")
CREATE OR REPLACE FUNCTION create_inbound_lead(p_lodge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_landlord_id UUID;
  v_lead_id UUID;
  v_exists BOOLEAN;
BEGIN
  v_student_id := auth.uid();
  
  -- Get Landlord ID
  SELECT landlord_id INTO v_landlord_id FROM public.lodges WHERE id = p_lodge_id;
  
  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'Lodge not found';
  END IF;

  -- Prevent self-lead
  IF v_student_id = v_landlord_id THEN
     RETURN jsonb_build_object('success', false, 'message', 'Cannot request chat with yourself');
  END IF;

  -- Check if exists
  SELECT TRUE INTO v_exists FROM public.leads 
  WHERE student_id = v_student_id AND lodge_id = p_lodge_id AND type = 'inbound';

  IF v_exists THEN
     RETURN jsonb_build_object('success', true, 'message', 'Request already sent');
  END IF;

  -- Create Lead
  INSERT INTO public.leads (type, student_id, landlord_id, lodge_id, status)
  VALUES ('inbound', v_student_id, v_landlord_id, p_lodge_id, 'pending')
  RETURNING id INTO v_lead_id;

  -- Notify Landlord
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_landlord_id, 
    'New Lead! 🔓', 
    'A student wants to chat about your lodge. Unlock now to view contact.', 
    'info', 
    '/profile/leads'
  );

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

-- 4. RPC: Unlock Student Request (Outbound/Market)
CREATE OR REPLACE FUNCTION unlock_student_request(p_request_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_landlord_id UUID;
  v_request RECORD;
  v_wallet_balance INT;
  v_cost INT;
  v_lead_id UUID;
  v_status TEXT;
  v_student_phone TEXT;
BEGIN
  v_landlord_id := auth.uid();

  -- 1. Fetch Request & Student Phone (Directly from profile, assuming RLS hides it normally)
  SELECT r.*, p.phone_number as student_phone 
  INTO v_request 
  FROM public.requests r
  JOIN public.profiles p ON r.student_id = p.id
  WHERE r.id = p_request_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Request not found';
  END IF;

  -- 2. Check if already unlocked
  SELECT id, status INTO v_lead_id, v_status 
  FROM public.leads 
  WHERE landlord_id = v_landlord_id AND request_id = p_request_id AND type = 'request_unlock';

  IF v_lead_id IS NOT NULL AND v_status = 'unlocked' THEN
     RETURN jsonb_build_object('success', true, 'phone_number', v_request.student_phone, 'message', 'Already unlocked');
  END IF;

  -- 3. Calculate Cost (Based on Student Budget)
  -- Use Max Budget or Min Budget
  v_cost := get_lead_cost(COALESCE(v_request.max_budget, v_request.min_budget, 0));

  -- 4. Check Wallet
  SELECT balance INTO v_wallet_balance FROM public.landlord_wallets WHERE landlord_id = v_landlord_id;
  
  IF v_wallet_balance IS NULL OR v_wallet_balance < v_cost THEN
    RAISE EXCEPTION 'Insufficient Z-Credits. Required: %, Balance: %', v_cost, COALESCE(v_wallet_balance, 0);
  END IF;

  -- 5. Execute
  -- Deduct
  UPDATE public.landlord_wallets 
  SET balance = balance - v_cost, 
      z_score = LEAST(100, z_score + 2)
  WHERE landlord_id = v_landlord_id;

  -- Create or Update Lead
  IF v_lead_id IS NOT NULL THEN
     UPDATE public.leads SET status = 'unlocked', unlocked_at = NOW(), unlock_cost = v_cost WHERE id = v_lead_id;
  ELSE
     INSERT INTO public.leads (type, student_id, landlord_id, request_id, status, unlock_cost, unlocked_at)
     VALUES ('request_unlock', v_request.student_id, v_landlord_id, p_request_id, 'unlocked', v_cost, NOW());
  END IF;

  -- Log
  INSERT INTO public.credit_transactions (landlord_id, amount, type, reference_id, description)
  VALUES (v_landlord_id, -v_cost, 'unlock_lead', p_request_id, 'Unlocked student request');

  RETURN jsonb_build_object('success', true, 'phone_number', v_request.student_phone, 'remaining_balance', v_wallet_balance - v_cost);
END;
$$;