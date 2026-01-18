-- Screw 1: Rate Limiting for Leads (Anti-Spam)
-- Prevent students from spamming "Request Chat" on hundreds of lodges
CREATE OR REPLACE FUNCTION create_inbound_lead(p_lodge_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_student_id UUID;
  v_landlord_id UUID;
  v_lead_id UUID;
  v_exists BOOLEAN;
  v_recent_count INT;
BEGIN
  v_student_id := auth.uid();
  
  -- Rate Limit Check: Max 10 requests per hour
  SELECT count(*) INTO v_recent_count 
  FROM public.leads 
  WHERE student_id = v_student_id 
    AND type = 'inbound' 
    AND created_at > NOW() - INTERVAL '1 hour';

  IF v_recent_count >= 10 THEN
    RAISE EXCEPTION 'Rate limit exceeded. You can only contact 10 landlords per hour.';
  END IF;
  
  -- Get Landlord ID
  SELECT landlord_id INTO v_landlord_id FROM public.lodges WHERE id = p_lodge_id;
  
  IF v_landlord_id IS NULL THEN
    RAISE EXCEPTION 'Lodge not found';
  END IF;

  -- Prevent self-lead
  IF v_student_id = v_landlord_id THEN
     RETURN jsonb_build_object('success', false, 'message', 'Cannot request chat with yourself');
  END IF;

  -- Check if exists
  SELECT TRUE INTO v_exists FROM public.leads 
  WHERE student_id = v_student_id AND lodge_id = p_lodge_id AND type = 'inbound';

  IF v_exists THEN
     RETURN jsonb_build_object('success', true, 'message', 'Request already sent');
  END IF;

  -- Create Lead
  INSERT INTO public.leads (type, student_id, landlord_id, lodge_id, status)
  VALUES ('inbound', v_student_id, v_landlord_id, p_lodge_id, 'pending')
  RETURNING id INTO v_lead_id;

  -- Notify Landlord
  INSERT INTO public.notifications (user_id, title, message, type, link)
  VALUES (
    v_landlord_id, 
    'New Lead! 🔓', 
    'A student wants to chat about your lodge. Unlock now to view contact.', 
    'info', 
    '/profile/leads'
  );

  RETURN jsonb_build_object('success', true, 'lead_id', v_lead_id);
END;
$$;

-- Screw 2: Atomic Deletion Logic
-- Update the delete_lodge RPC to be the "source of truth" for deletion
-- Note: We can't easily call Cloudinary from PL/pgSQL without an Edge Function trigger.
-- For now, we will trust the existing client-side flow BUT we will enforce integrity here.
-- We ensure that when this RPC is called, we cascade delete properly (which ON DELETE CASCADE does, but we add logic here if needed).
-- Actually, the best fix here is to ensuring the `delete_lodge` RPC is robust.

CREATE OR REPLACE FUNCTION delete_lodge(lodge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Verify ownership or admin
  IF NOT EXISTS (
    SELECT 1 FROM public.lodges 
    WHERE id = lodge_id 
    AND (landlord_id = auth.uid() OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'))
  ) THEN
    RAISE EXCEPTION 'Access Denied';
  END IF;

  -- Delete (Cascades to units, reviews, favorites via FKs)
  DELETE FROM public.lodges WHERE id = lodge_id;
END;
$$;
