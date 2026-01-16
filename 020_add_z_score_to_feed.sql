-- Update get_lodges_feed to include Z-Score
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
  profile_data JSONB,
  units_data JSONB,
  landlord_z_score INT -- New Column
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
    ) as units_data,
    COALESCE(lw.z_score, 50) as landlord_z_score -- Default to 50 if no wallet
  FROM lodges l
  LEFT JOIN profiles p ON l.landlord_id = p.id
  LEFT JOIN landlord_wallets lw ON l.landlord_id = lw.landlord_id
  WHERE l.status = 'available'
  ORDER BY 
    (CASE WHEN l.promoted_until > NOW() THEN 1 ELSE 0 END) DESC, -- Active promotions first
    l.created_at DESC -- Then newest
  LIMIT page_limit
  OFFSET page_offset;
END;
$$;