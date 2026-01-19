-- Phase 4: BlurHash Support
-- Add columns to store the blurhash strings for images
ALTER TABLE public.lodges 
ADD COLUMN IF NOT EXISTS image_blurhashes TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public.lodge_units 
ADD COLUMN IF NOT EXISTS image_blurhashes TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update RPC to include this new column
CREATE OR REPLACE FUNCTION public.get_lodges_feed(page_offset integer, page_limit integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
    result JSONB;
BEGIN
    WITH sorted_data AS (
        SELECT 
            l.id,
            l.created_at,
            l.title,
            l.description,
            l.price,
            l.location,
            l.image_urls,
            l.image_blurhashes, -- Added
            l.landlord_id,
            l.status,
            l.amenities,
            l.landmark,
            l.promoted_until,
            l.views,
            -- Profile Data
            p.id as p_id,
            p.name as p_name,
            p.role as p_role,
            p.email as p_email,
            p.avatar_url as p_avatar,
            p.is_verified as p_verified,
            p.created_at as p_created,
            -- Wallet Data
            COALESCE(lw.z_score, 50) as real_z_score
        FROM lodges l
        JOIN profiles p ON l.landlord_id = p.id
        LEFT JOIN landlord_wallets lw ON l.landlord_id = lw.landlord_id
        WHERE l.status != 'taken'
        ORDER BY 
            CASE WHEN l.promoted_until > NOW() THEN 0 ELSE 1 END ASC,
            CASE WHEN COALESCE(lw.z_score, 50) < 30 THEN 1 ELSE 0 END ASC,
            CASE WHEN COALESCE(lw.z_score, 50) > 80 THEN 0 ELSE 1 END ASC,
            l.created_at DESC
        OFFSET page_offset
        LIMIT page_limit
    )
    SELECT jsonb_agg(
        jsonb_build_object(
            'id', id,
            'created_at', created_at,
            'title', title,
            'description', description,
            'price', price,
            'location', location,
            'image_urls', image_urls,
            'image_blurhashes', COALESCE(image_blurhashes, ARRAY[]::TEXT[]), -- Added
            'landlord_id', landlord_id,
            'status', status,
            'amenities', COALESCE(amenities, '[]'::jsonb),
            'landmark', landmark,
            'promoted_until', promoted_until,
            'views', views,
            'profile_data', jsonb_build_object(
                'id', p_id,
                'name', p_name,
                'role', p_role,
                'email', p_email,
                'avatar_url', p_avatar,
                'is_verified', p_verified,
                'phone_number', NULL,
                'created_at', p_created
            ),
            'units_data', COALESCE(
                (SELECT jsonb_agg(jsonb_build_object(
                    'id', u.id,
                    'name', u.name,
                    'price', u.price,
                    'available_units', u.available_units,
                    'image_urls', u.image_urls,
                    'image_blurhashes', COALESCE(u.image_blurhashes, ARRAY[]::TEXT[]) -- Added
                )) FROM lodge_units u WHERE u.lodge_id = sorted_data.id), 
                '[]'::jsonb
            ),
            'landlord_z_score', real_z_score
        )
    )
    INTO result
    FROM sorted_data;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;
