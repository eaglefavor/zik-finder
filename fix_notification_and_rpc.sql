-- FIX: Allow landlords to notify students securely via RPC (Bypasses RLS)
CREATE OR REPLACE FUNCTION notify_student_of_match(
  p_student_id UUID,
  p_lodge_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_landlord_id UUID;
  v_lodge_title TEXT;
  v_student_exists BOOLEAN;
BEGIN
  v_landlord_id := auth.uid();

  -- 1. Validate Lodge Ownership
  SELECT title INTO v_lodge_title 
  FROM lodges 
  WHERE id = p_lodge_id AND landlord_id = v_landlord_id;

  IF v_lodge_title IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Lodge not found or unauthorized');
  END IF;

  -- 2. Validate Student Exists
  SELECT TRUE INTO v_student_exists FROM profiles WHERE id = p_student_id;
  IF v_student_exists IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Student not found');
  END IF;

  -- 3. Insert Notification
  INSERT INTO notifications (user_id, title, message, type, link)
  VALUES (
    p_student_id,
    'Lodge Match! 🏠',
    'A landlord has a lodge ("' || v_lodge_title || '") that matches your request!',
    'success',
    '/lodge/' || p_lodge_id
  );

  RETURN jsonb_build_object('success', true);
END;
$$;
