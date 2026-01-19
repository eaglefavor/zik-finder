-- Delta Sync Support
-- We need an RPC that takes a timestamp and returns the feed, but intelligently drops data for known items.

CREATE OR REPLACE FUNCTION public.get_lodges_feed_smart(
    page_offset integer, 
    page_limit integer,
    last_sync timestamp with time zone DEFAULT '1970-01-01'::timestamp with time zone
)
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
            l.updated_at, -- Crucial for Delta Sync
            l.title,
            l.description,
            l.price,
            l.location,
            l.image_urls,
            l.image_blurhashes,
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
        CASE 
            -- DELTA LOGIC: If the item hasn't changed since last_sync, return a "stub"
            -- We assume the client keeps the old data if it sees a stub.
            -- Note: We check l.updated_at. If null, fallback to created_at.
            WHEN COALESCE(sorted_data.updated_at, sorted_data.created_at) <= last_sync THEN
                jsonb_build_object(
                    'id', id,
                    '_delta', 'unchanged' -- Signal to client
                )
            ELSE
                -- Full Object (Same as standard feed)
                jsonb_build_object(
                    'id', id,
                    '_delta', 'update',
                    'created_at', created_at,
                    'updated_at', updated_at,
                    'title', title,
                    'description', description,
                    'price', price,
                    'location', location,
                    'image_urls', image_urls,
                    'image_blurhashes', COALESCE(image_blurhashes, ARRAY[]::TEXT[]),
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
                            'image_blurhashes', COALESCE(u.image_blurhashes, ARRAY[]::TEXT[])
                        )) FROM lodge_units u WHERE u.lodge_id = sorted_data.id), 
                        '[]'::jsonb
                    ),
                    'landlord_z_score', real_z_score
                )
        END
    )
    INTO result
    FROM sorted_data;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$function$;
