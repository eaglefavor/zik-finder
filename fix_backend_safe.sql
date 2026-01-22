-- 1. SECURITY: Drop the dangerously permissive Profile policy
DROP POLICY IF EXISTS "Public profiles are viewable" ON profiles;

-- 2. SECURITY: Lock down Notifications (Prevent user spam)
-- Drop the policy allowing inserts
DROP POLICY IF EXISTS "Any authenticated user can insert notifications" ON notifications;
-- Create a new policy that DENIES inserts (implicit default, but let's be explicit if needed, or just leave it dropped)
-- Note: Functions/Triggers (SECURITY DEFINER) can still insert.

-- 3. SECURITY: Secure Critical Functions (Bypass RLS securely)
ALTER FUNCTION get_lodges_feed(int, int) SECURITY DEFINER;
ALTER FUNCTION get_lodges_feed_smart(int, int, timestamptz) SECURITY DEFINER;
ALTER FUNCTION send_lodge_inquiry(uuid, text) SECURITY DEFINER;
ALTER FUNCTION create_inbound_lead(uuid) SECURITY DEFINER;
ALTER FUNCTION unlock_lead(uuid) SECURITY DEFINER;
ALTER FUNCTION unlock_student_request(uuid) SECURITY DEFINER;

-- 4. CLEANUP: Remove redundant table
DROP TABLE IF EXISTS unlocked_leads;

-- 5. OPTIMIZATION: Update Smart Feed for Delta Sync
-- Ensure it returns the correct structure and handles NULLs
CREATE OR REPLACE FUNCTION get_lodges_feed_smart(
    page_offset INTEGER,
    page_limit INTEGER,
    last_sync TIMESTAMPTZ DEFAULT '1970-01-01 00:00:00+00'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs as Creator (Admin), bypasses RLS to ensure we can read all profiles/lodges
AS $$
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
            -- DELTA LOGIC: If unchanged, return stub
            -- Note: We check if the record has been modified AFTER the last_sync
            WHEN COALESCE(sorted_data.updated_at, sorted_data.created_at) <= last_sync THEN
                jsonb_build_object(
                    'id', sorted_data.id,
                    '_delta', 'unchanged'
                )
            ELSE
                -- Full Object
                jsonb_build_object(
                    'id', sorted_data.id,
                    '_delta', 'update',
                    'created_at', sorted_data.created_at,
                    'updated_at', sorted_data.updated_at,
                    'title', sorted_data.title,
                    'description', sorted_data.description,
                    'price', sorted_data.price,
                    'location', sorted_data.location,
                    'image_urls', sorted_data.image_urls,
                    'image_blurhashes', COALESCE(sorted_data.image_blurhashes, ARRAY[]::TEXT[]),
                    'landlord_id', sorted_data.landlord_id,
                    'status', sorted_data.status,
                    'amenities', COALESCE(sorted_data.amenities, '[]'::jsonb),
                    'landmark', sorted_data.landmark,
                    'promoted_until', sorted_data.promoted_until,
                    'views', sorted_data.views,
                    'profile_data', jsonb_build_object(
                        'id', sorted_data.p_id,
                        'name', sorted_data.p_name,
                        'role', sorted_data.p_role,
                        'email', sorted_data.p_email,
                        'avatar_url', sorted_data.p_avatar,
                        'is_verified', sorted_data.p_verified,
                        'phone_number', NULL, -- PRIVACY: Always hide phone here
                        'created_at', sorted_data.p_created
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
                    'landlord_z_score', sorted_data.real_z_score
                )
        END
    )
    INTO result
    FROM sorted_data;

    RETURN COALESCE(result, '[]'::jsonb);
END;
$$;
