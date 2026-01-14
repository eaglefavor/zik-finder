-- ==========================================
-- ZIPS 4.0: WALLET & REVENUE LOGIC
-- ==========================================

-- RPC: Handle Credit Top-up (Atomic)
CREATE OR REPLACE FUNCTION handle_credit_topup(
  p_user_id UUID,
  p_credits INT,
  p_amount_naira NUMERIC,
  p_reference TEXT,
  p_bonus INT DEFAULT 0
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Security Check: Only the service_role (Edge Functions) should call this directly
  IF auth.role() != 'service_role' THEN
    RAISE EXCEPTION 'Unauthorized: This function can only be called by the system.';
  END IF;

  -- 1. Create or Update Wallet
  INSERT INTO public.landlord_wallets (landlord_id, balance, z_score)
  VALUES (p_user_id, p_credits, 50 + 5) -- Starting 50 + 5 bonus for first purchase
  ON CONFLICT (landlord_id) DO UPDATE SET
    balance = public.landlord_wallets.balance + p_credits,
    z_score = LEAST(100, public.landlord_wallets.z_score + 5);

  -- 2. Log Transaction
  INSERT INTO public.credit_transactions (
    landlord_id,
    amount,
    type,
    reference_id,
    description
  ) VALUES (
    p_user_id,
    p_credits,
    'purchase',
    NULL, -- No reference_id for general top-up
    'Credit Top-up (₦' || p_amount_naira || ')' || CASE WHEN p_bonus > 0 THEN ' includes ' || p_bonus || ' bonus' ELSE '' END
  );

  RETURN jsonb_build_object('success', true, 'new_balance', (SELECT balance FROM public.landlord_wallets WHERE landlord_id = p_user_id));
END;
$$;

-- RPC: Get Wallet Stats
CREATE OR REPLACE FUNCTION get_wallet_stats(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  -- Security: Users can only see their own wallet stats
  IF auth.uid() != p_user_id AND (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
    RAISE EXCEPTION 'Access Denied: You can only view your own wallet stats.';
  END IF;

  SELECT * INTO v_wallet FROM public.landlord_wallets WHERE landlord_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'balance', 0,
      'z_score', 50,
      'is_verified', false
    );
  END IF;

  RETURN jsonb_build_object(
    'balance', v_wallet.balance,
    'z_score', v_wallet.z_score,
    'is_verified', v_wallet.is_verified,
    'verified_at', v_wallet.verified_at
  );
END;
$$;
