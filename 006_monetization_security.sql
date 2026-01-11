-- Secure the Landlord Verification Process (Idempotent Version)

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
  v_existing_tx RECORD;
BEGIN
  v_user_id := auth.uid();
  
  -- 1. Basic Validation
  IF p_payment_reference IS NULL OR length(p_payment_reference) < 5 THEN
    RAISE EXCEPTION 'Invalid payment reference';
  END IF;

  -- 2. Idempotency Check (Transaction Recording)
  SELECT * INTO v_existing_tx 
  FROM monetization_transactions 
  WHERE reference = p_payment_reference;

  IF FOUND THEN
      -- Allow retry if it's the same user and purpose
      IF v_existing_tx.user_id != v_user_id OR v_existing_tx.purpose != 'verification_fee' THEN
          RAISE EXCEPTION 'Reference already used';
      END IF;
      -- Proceed to doc update (Retry Scenario)
  ELSE
      -- New Transaction
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
        'success'
      );
  END IF;

  -- 3. Manage Verification Docs
  DELETE FROM verification_docs 
  WHERE landlord_id = v_user_id AND status = 'rejected';

  INSERT INTO verification_docs (
    landlord_id,
    id_card_path,
    id_card_url,
    selfie_path,
    selfie_url,
    status,
    payment_status,
    payment_reference
  ) VALUES (
    v_user_id,
    p_id_card_path,
    NULL,
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

-- Strengthen promote_lodge (Idempotent Version)
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
  v_existing_tx RECORD;
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

  -- Idempotency Check
  SELECT * INTO v_existing_tx 
  FROM monetization_transactions 
  WHERE reference = p_payment_reference;

  IF FOUND THEN
      IF v_existing_tx.user_id != v_user_id OR v_existing_tx.purpose != 'promoted_listing' THEN
          RAISE EXCEPTION 'Reference already used';
      END IF;
      -- If retry, ensure we don't extend date TWICE for the same ref? 
      -- Actually, checking metadata would be best, but for now we trust the logic.
      -- To be safe, we calculate expiry based on current value, so re-running this 
      -- would extend it AGAIN. That's bad.
      
      -- Fix: Don't extend if transaction exists. Just return current expiry.
      -- (Assuming the first run succeeded in updating lodge but maybe network failed returning response)
      
      SELECT promoted_until INTO v_new_expiry FROM lodges WHERE id = p_lodge_id;
      
      RETURN jsonb_build_object(
        'success', true, 
        'promoted_until', v_new_expiry,
        'message', 'Promotion already active'
      );
  ELSE
      -- New Transaction
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
  END IF;

  RETURN jsonb_build_object(
    'success', true, 
    'promoted_until', v_new_expiry
  );
END;
$$;