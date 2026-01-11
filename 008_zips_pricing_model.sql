-- ==========================================
-- ZIKLODGE INTELLIGENT PRICING SYSTEM (ZIPS)
-- ==========================================

-- 1. Pricing Configuration Table
CREATE TABLE IF NOT EXISTS public.pricing_configs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    category_slug TEXT UNIQUE NOT NULL, -- 'single', 'self_con', 'flat'
    display_name TEXT NOT NULL,
    floor_price NUMERIC NOT NULL DEFAULT 0,
    percentage_fee NUMERIC NOT NULL DEFAULT 0.05,
    cap_amount NUMERIC NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.pricing_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read access" ON public.pricing_configs FOR SELECT USING (true);

-- Seed Data (2026 Baseline)
INSERT INTO public.pricing_configs (category_slug, display_name, floor_price, percentage_fee, cap_amount)
VALUES 
('single', 'Single Room', 80000, 0.05, 8000),
('self_con', 'Self-Contained', 250000, 0.05, 20000),
('flat', 'Flat / Apartment', 500000, 0.05, 30000)
ON CONFLICT (category_slug) DO UPDATE SET
floor_price = EXCLUDED.floor_price,
percentage_fee = EXCLUDED.percentage_fee,
cap_amount = EXCLUDED.cap_amount;

-- 2. Schema Updates for Lodges and Units

-- Add Listing Status columns to Lodges
ALTER TABLE public.lodges 
ADD COLUMN IF NOT EXISTS listing_expiry TIMESTAMPTZ DEFAULT NULL,
ADD COLUMN IF NOT EXISTS is_listing_verified BOOLEAN DEFAULT FALSE;

-- Add Pricing Category to Units
ALTER TABLE public.lodge_units
ADD COLUMN IF NOT EXISTS pricing_category TEXT REFERENCES public.pricing_configs(category_slug) DEFAULT 'self_con';

-- 3. Security Protocols (Triggers)

-- Defense B: The "Sanitizer" (Anti-Phone Injection)
CREATE OR REPLACE FUNCTION sanitize_listing_content()
RETURNS TRIGGER AS $$
DECLARE
  phone_regex TEXT := '0[789][01]\d{8}|(\+?234|0)[789][01]\d{8}'; 
BEGIN
  -- Strip phone numbers from Title
  IF NEW.title IS NOT NULL THEN
    NEW.title := regexp_replace(NEW.title, phone_regex, '[HIDDEN]', 'g');
  END IF;
  
  -- Strip phone numbers from Description (for Lodges table)
  IF TG_TABLE_NAME = 'lodges' AND NEW.description IS NOT NULL THEN
    NEW.description := regexp_replace(NEW.description, phone_regex, '[HIDDEN]', 'g');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_sanitize_lodge ON public.lodges;
CREATE TRIGGER trig_sanitize_lodge
BEFORE INSERT OR UPDATE ON public.lodges
FOR EACH ROW EXECUTE FUNCTION sanitize_listing_content();

-- Defense C: The "Bulk Blocker" (Anti-Description Fraud)
CREATE OR REPLACE FUNCTION block_bulk_fraud()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.description ~* '(other rooms|different prices|call for others|units remaining|more units)' THEN
    RAISE EXCEPTION 'Bulk Fraud Detected: Descriptions cannot advertise multiple unlisted units. Please list each unit type separately.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_block_bulk_desc ON public.lodges;
CREATE TRIGGER trig_block_bulk_desc
BEFORE INSERT OR UPDATE ON public.lodges
FOR EACH ROW EXECUTE FUNCTION block_bulk_fraud();

-- Defense A: The "Price Lock" Trigger (Anti-Bait & Switch)
CREATE OR REPLACE FUNCTION enforce_price_lock()
RETURNS TRIGGER AS $$
BEGIN
  -- If price increases
  IF NEW.price > OLD.price THEN
    -- Strip verification status from the PARENT lodge
    UPDATE public.lodges 
    SET is_listing_verified = FALSE 
    WHERE id = NEW.lodge_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_price_lock_units ON public.lodge_units;
CREATE TRIGGER trig_price_lock_units
BEFORE UPDATE ON public.lodge_units
FOR EACH ROW 
WHEN (NEW.price > OLD.price)
EXECUTE FUNCTION enforce_price_lock();


-- 4. Logic: Fee Calculator
-- Calculates the total fee for a Lodge based on its units and volume discounts
CREATE OR REPLACE FUNCTION calculate_listing_fee(p_lodge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_unit RECORD;
  v_config RECORD;
  v_total_fee NUMERIC := 0;
  v_unit_count INT := 0;
  v_discount_percent NUMERIC := 0;
  v_unit_fee NUMERIC;
  v_calculation_base NUMERIC;
  v_breakdown JSONB := '[]'::jsonb;
BEGIN
  -- Loop through all units for this lodge
  FOR v_unit IN SELECT * FROM lodge_units WHERE lodge_id = p_lodge_id LOOP
    v_unit_count := v_unit_count + 1;
    
    -- Fetch pricing config for this unit type
    SELECT * INTO v_config FROM pricing_configs WHERE category_slug = v_unit.pricing_category;
    
    -- Default to 'self_con' rules if category missing
    IF NOT FOUND THEN
       SELECT * INTO v_config FROM pricing_configs WHERE category_slug = 'self_con';
    END IF;

    -- The Pricing Matrix Logic
    -- 1. Floor Rule: Use max(InputPrice, Floor)
    v_calculation_base := GREATEST(v_unit.price, v_config.floor_price);
    
    -- 2. 5% Calculation
    v_unit_fee := v_calculation_base * v_config.percentage_fee;
    
    -- 3. Cap Rule: Fee cannot exceed Cap
    v_unit_fee := LEAST(v_unit_fee, v_config.cap_amount);
    
    -- Add to total
    v_total_fee := v_total_fee + v_unit_fee;
    
    -- Add to breakdown
    v_breakdown := v_breakdown || jsonb_build_object(
        'unit_id', v_unit.id,
        'unit_name', v_unit.name,
        'base_price', v_unit.price,
        'floor_applied', (v_unit.price < v_config.floor_price),
        'cap_applied', (v_unit_fee = v_config.cap_amount),
        'fee', v_unit_fee
    );
  END LOOP;

  -- 4. Volume Discounts
  IF v_unit_count >= 10 THEN
     v_discount_percent := 0.15; -- 15% off
  ELSIF v_unit_count >= 5 THEN
     v_discount_percent := 0.10; -- 10% off
  END IF;

  v_total_fee := v_total_fee * (1 - v_discount_percent);

  RETURN jsonb_build_object(
    'total_fee', v_total_fee,
    'unit_count', v_unit_count,
    'discount_percent', v_discount_percent,
    'breakdown', v_breakdown
  );
END;
$$;

-- 5. Helper to Activate Listing (Called by Payment Edge Function)
CREATE OR REPLACE FUNCTION activate_lodge_listing(p_lodge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.lodges
  SET 
    is_listing_verified = TRUE,
    listing_expiry = NOW() + INTERVAL '1 year',
    status = 'available' -- Automatically publish
  WHERE id = p_lodge_id;
  
  RETURN jsonb_build_object('success', true);
END;
$$;
