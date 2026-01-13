-- Trigger to Auto-Initialize Wallet on Signup
-- Implements "First 10 Landlords" Promo

CREATE OR REPLACE FUNCTION init_landlord_wallet()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
  v_bonus INT := 0;
BEGIN
  -- Only for landlords
  IF NEW.role = 'landlord' THEN
    
    -- Check how many wallets exist
    SELECT count(*) INTO v_count FROM public.landlord_wallets;

    -- First 10 get 50 Credits
    IF v_count < 10 THEN
       v_bonus := 50;
    END IF;

    -- Create Wallet
    INSERT INTO public.landlord_wallets (landlord_id, balance, z_score)
    VALUES (NEW.id, v_bonus, 50);

    -- Log Bonus if applicable
    IF v_bonus > 0 THEN
        INSERT INTO public.credit_transactions (landlord_id, amount, type, description)
        VALUES (NEW.id, v_bonus, 'legacy_gift', 'First 10 Promo Bonus! 🚀');
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Bind to profiles
DROP TRIGGER IF EXISTS trig_init_wallet ON public.profiles;
CREATE TRIGGER trig_init_wallet
AFTER INSERT ON public.profiles
FOR EACH ROW EXECUTE FUNCTION init_landlord_wallet();
