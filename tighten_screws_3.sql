-- Screw 1: Tighten Inbound Lead Rate Limiting (The "Intent Filter")
-- Changing from "10 per hour" (Spammy) to "5 per 24 hours" (High Intent)
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
  
  -- Rate Limit Check: Max 5 requests per 24 hours
  -- This forces students to carefully select the 5 lodges they are most interested in.
  -- Landlords paying for these leads can be assured the student isn't "window shopping" 50 places.
  SELECT count(*) INTO v_recent_count 
  FROM public.leads 
  WHERE student_id = v_student_id 
    AND type = 'inbound' 
    AND created_at > NOW() - INTERVAL '24 hours';

  IF v_recent_count >= 5 THEN
    RAISE EXCEPTION 'Daily limit reached. To ensure high quality connections, you can only contact 5 landlords per day.';
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

-- Screw 2: Enforce Single Active Request Policy
-- Students should only have ONE active request in the marketplace at a time.
-- Multiple requests dilute the marketplace and confuse landlords.
CREATE OR REPLACE FUNCTION enforce_single_active_request()
RETURNS TRIGGER AS $$
DECLARE
  v_active_count INT;
BEGIN
  -- Check for existing active requests (excluding the one being updated/inserted if applicable)
  SELECT count(*) INTO v_active_count 
  FROM public.requests 
  WHERE student_id = NEW.student_id 
    AND expires_at > NOW(); -- Assuming active means not expired

  -- If this is an INSERT, count must be 0. If UPDATE, we rely on ID check (omitted for simplicity here as usually students don't update ID)
  -- Simplified: If they have > 0 active requests, block INSERT.
  IF TG_OP = 'INSERT' AND v_active_count > 0 THEN
    RAISE EXCEPTION 'You already have an active request. Please delete or wait for your current request to expire before posting a new one.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Trigger
DROP TRIGGER IF EXISTS trig_single_request ON public.requests;
CREATE TRIGGER trig_single_request
BEFORE INSERT ON public.requests
FOR EACH ROW EXECUTE FUNCTION enforce_single_active_request();
