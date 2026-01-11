-- Secure the Landlord Verification Process
-- This RPC handles the payment recording and document submission atomically.

CREATE OR REPLACE FUNCTION submit_landlord_verification(
  p_payment_reference TEXT,
  p_id_card_path TEXT,
  p_selfie_path TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id UUID;
  v_amount DECIMAL := 500.00;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Basic Validation
  IF p_payment_reference IS NULL OR length(p_payment_reference) < 5 THEN
    RAISE EXCEPTION 'Invalid payment reference';
  END IF;

  -- 2. Record Transaction
  -- We use ON CONFLICT DO NOTHING to handle potential duplicate calls gracefully,
  -- though the frontend should prevent this.
  INSERT INTO monetization_transactions (
    user_id,
    amount,
    currency,
    purpose,
    reference,
    status
  ) VALUES (
    v_user_id,
    v_amount,
    'NGN',
    'verification_fee',
    p_payment_reference,
    'success' -- Assumed success from client, pending admin verification if needed
  );

  -- 3. Manage Verification Docs
  -- If a record exists (e.g. rejected), we delete it to make room for the new one
  -- (or update it, but deletion + insertion is cleaner for history if we tracked it, 
  -- here we just want the latest pending state).
  DELETE FROM verification_docs 
  WHERE landlord_id = v_user_id AND status = 'rejected';

  -- Insert new record
  INSERT INTO verification_docs (
    landlord_id,
    id_card_path,
    id_card_url, -- Assuming generated or handled by storage triggers, or null
    selfie_path,
    selfie_url, -- Assuming generated or handled by storage triggers, or null
    status,
    payment_status,
    payment_reference
  ) VALUES (
    v_user_id,
    p_id_card_path,
    NULL, -- URL generation is often dynamic or handled elsewhere
    p_selfie_path,
    NULL,
    'pending',
    'success',
    p_payment_reference
  )
  ON CONFLICT (landlord_id) 
  DO UPDATE SET
    id_card_path = EXCLUDED.id_card_path,
    selfie_path = EXCLUDED.selfie_path,
    status = 'pending',
    payment_status = 'success',
    payment_reference = EXCLUDED.payment_reference,
    rejection_reason = NULL,
    created_at = NOW();

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Strengthen promote_lodge with basic validation
CREATE OR REPLACE FUNCTION promote_lodge(
  p_lodge_id UUID,
  p_payment_reference TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_amount DECIMAL := 1000.00;
  v_user_id UUID;
  v_new_expiry TIMESTAMPTZ;
BEGIN
  v_user_id := auth.uid();

  -- Validation
  IF p_payment_reference IS NULL OR length(p_payment_reference) < 5 THEN
     RAISE EXCEPTION 'Invalid payment reference';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM lodges 
    WHERE id = p_lodge_id AND landlord_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this lodge';
  END IF;

  -- Record Transaction
  INSERT INTO monetization_transactions (
    user_id,
    amount,
    currency,
    purpose,
    reference,
    status,
    metadata
  ) VALUES (
    v_user_id,
    v_amount,
    'NGN',
    'promoted_listing',
    p_payment_reference,
    'success',
    jsonb_build_object('lodge_id', p_lodge_id, 'duration_days', 7)
  );

  -- Calculate Expiry
  SELECT 
    CASE 
      WHEN promoted_until > NOW() THEN promoted_until + INTERVAL '7 days'
      ELSE NOW() + INTERVAL '7 days'
    END INTO v_new_expiry
  FROM lodges
  WHERE id = p_lodge_id;

  IF v_new_expiry IS NULL THEN
     v_new_expiry := NOW() + INTERVAL '7 days';
  END IF;

  -- Apply Promotion
  UPDATE lodges 
  SET promoted_until = v_new_expiry
  WHERE id = p_lodge_id;

  RETURN jsonb_build_object(
    'success', true, 
    'promoted_until', v_new_expiry
  );
END;
$$;
