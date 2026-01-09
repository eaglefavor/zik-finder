-- 1. CLEANUP: Remove scrapped "Official Photos" feature
ALTER TABLE lodges DROP COLUMN IF EXISTS is_official_photos;

-- 2. SCHEMA: Add Promoted Listings support
ALTER TABLE lodges ADD COLUMN IF NOT EXISTS promoted_until TIMESTAMPTZ DEFAULT NULL;

-- Index for faster sorting/filtering of active promotions
CREATE INDEX IF NOT EXISTS idx_lodges_promoted_until ON lodges(promoted_until);

-- 3. RPC: Function to handle the promotion logic
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

  IF NOT EXISTS (
    SELECT 1 FROM lodges 
    WHERE id = p_lodge_id AND landlord_id = v_user_id
  ) THEN
    RAISE EXCEPTION 'Unauthorized: You do not own this lodge';
  END IF;

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

  UPDATE lodges 
  SET promoted_until = v_new_expiry
  WHERE id = p_lodge_id;

  RETURN jsonb_build_object(
    'success', true, 
    'promoted_until', v_new_expiry
  );
END;
$$;

-- 4. RPC: Smart Feed Fetcher
-- Sorts active promotions to the top, then new posts.
CREATE OR REPLACE FUNCTION get_lodges_feed(
  page_offset INT DEFAULT 0,
  page_limit INT DEFAULT 10
)
RETURNS TABLE (
  id UUID,
  created_at TIMESTAMPTZ,
  title TEXT,
  description TEXT,
  price NUMERIC,
  location TEXT,
  image_urls TEXT[],
  landlord_id UUID,
  status TEXT,
  amenities TEXT[],
  landmark TEXT,
  promoted_until TIMESTAMPTZ,
  views BIGINT,
  -- We return joined profile data as a JSON object to mimic the join
  profile_data JSONB,
  units_data JSONB
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.created_at,
    l.title,
    l.description,
    l.price,
    l.location,
    l.image_urls,
    l.landlord_id,
    l.status,
    l.amenities,
    l.landmark,
    l.promoted_until,
    l.views,
    to_jsonb(p) as profile_data,
    (
       SELECT jsonb_agg(u.*) 
       FROM lodge_units u 
       WHERE u.lodge_id = l.id
    ) as units_data
  FROM lodges l
  LEFT JOIN profiles p ON l.landlord_id = p.id
  WHERE l.status = 'available'
  ORDER BY 
    (CASE WHEN l.promoted_until > NOW() THEN 1 ELSE 0 END) DESC, -- Active promotions first
    l.created_at DESC -- Then newest
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;