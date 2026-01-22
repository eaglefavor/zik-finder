-- 1. FIX: Correct the RLS Policy for Profiles (Fixes 'Student' name issue)
DROP POLICY IF EXISTS "Public and Active profiles are viewable" ON profiles;

CREATE POLICY "Public and Active profiles are viewable" ON profiles
FOR SELECT
USING (
  (auth.uid() = id) -- Owner
  OR (role = 'landlord') -- Landlords (Public)
  OR (
    role = 'student' 
    AND EXISTS (
      SELECT 1 FROM requests 
      WHERE requests.student_id = profiles.id -- FIXED: Was requests.id
    )
  )
  OR is_admin() -- Admins
);

-- 2. FEATURE: RPC for Leads Page (Fixes 'Contact Missing')
-- Bypasses Column Security to fetch phone numbers for the landlord
CREATE OR REPLACE FUNCTION get_landlord_leads()
RETURNS TABLE (
  id UUID,
  type TEXT,
  status TEXT,
  created_at TIMESTAMPTZ,
  lodge_title TEXT,
  lodge_location TEXT,
  lodge_price INT,
  student_name TEXT,
  student_phone TEXT,
  unlock_cost INT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.id,
    l.type,
    l.status,
    l.created_at,
    lo.title as lodge_title,
    lo.location as lodge_location,
    lo.price as lodge_price,
    p.name as student_name,
    CASE 
      WHEN l.status = 'unlocked' THEN p.phone_number
      ELSE NULL 
    END as student_phone,
    l.unlock_cost
  FROM leads l
  JOIN lodges lo ON l.lodge_id = lo.id
  JOIN profiles p ON l.student_id = p.id
  WHERE l.landlord_id = auth.uid()
  AND l.type = 'inbound'
  ORDER BY l.created_at DESC;
END;
$$;

-- 3. FEATURE: RPC for Market Page (Fixes 'Locked back again')
CREATE OR REPLACE FUNCTION get_my_unlocked_requests()
RETURNS TABLE (
  request_id UUID,
  student_phone TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    l.request_id,
    p.phone_number
  FROM leads l
  JOIN profiles p ON l.student_id = p.id
  WHERE l.landlord_id = auth.uid()
  AND l.type = 'request_unlock'
  AND l.status = 'unlocked'
  AND l.request_id IS NOT NULL;
END;
$$;
