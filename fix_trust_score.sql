-- Fix Trust Score Visibility for Public Users
-- 1. Drop the existing function (signature must match exactly)
DROP FUNCTION IF EXISTS get_lodges_feed(INTEGER, INTEGER);

-- 2. Recreate it with SECURITY DEFINER to bypass RLS on landlord_wallets
CREATE OR REPLACE FUNCTION get_lodges_feed(page_offset INT, page_limit INT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    result JSONB;
BEGIN
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', l.id,
            'created_at', l.created_at,
            'title', l.title,
            'description', l.description,
            'price', l.price,
            'location', l.location,
            'image_urls', l.image_urls,
            'landlord_id', l.landlord_id,
            'status', l.status,
            'amenities', COALESCE(l.amenities, '[]'::jsonb),
            'landmark', l.landmark,
            'promoted_until', l.promoted_until,
            'views', l.views,
            'profile_data', p,
            'units_data', COALESCE(
                (SELECT jsonb_agg(u) FROM lodge_units u WHERE u.lodge_id = l.id), 
                '[]'::jsonb
            ),
            'landlord_z_score', COALESCE(lw.z_score, 50)
        )
    )
    INTO result
    FROM lodges l
    JOIN profiles p ON l.landlord_id = p.id
    LEFT JOIN landlord_wallets lw ON l.landlord_id = lw.landlord_id
    WHERE l.status != 'taken'
    ORDER BY 
        CASE WHEN l.promoted_until > NOW() THEN 0 ELSE 1 END,
        l.created_at DESC
    OFFSET page_offset
    LIMIT page_limit;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;