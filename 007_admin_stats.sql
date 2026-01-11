-- Admin Helper for Storage Stats
CREATE OR REPLACE FUNCTION get_storage_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total_size BIGINT;
  v_count BIGINT;
  v_role TEXT;
BEGIN
  -- Check Admin Permission
  SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();
  
  IF v_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'Access Denied: Admins Only';
  END IF;

  SELECT 
    COALESCE(SUM((metadata->>'size')::bigint), 0),
    COUNT(*)
  INTO v_total_size, v_count
  FROM storage.objects;

  RETURN jsonb_build_object(
    'total_bytes', v_total_size,
    'file_count', v_count
  );
END;
$$;
