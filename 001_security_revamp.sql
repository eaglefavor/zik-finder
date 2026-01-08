-- ==============================================================================
-- ZIKLODGE SECURITY REVAMP MISSION
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. SECURE FUNCTIONS (Fixing "SECURITY DEFINER" Vulnerabilities)
-- ------------------------------------------------------------------------------

-- 1.1 Secure `broadcast_notification`
-- Only Admins should be able to broadcast.
CREATE OR REPLACE FUNCTION public.broadcast_notification(
    p_title TEXT, 
    p_message TEXT, 
    p_type TEXT DEFAULT 'info', 
    p_target_role TEXT DEFAULT 'all'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public -- Prevent search_path hijacking
AS $$
BEGIN
    -- Authorization Check
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can broadcast notifications.';
    END IF;

    INSERT INTO public.notifications (user_id, title, message, type)
    SELECT id, p_title, p_message, p_type
    FROM public.profiles
    WHERE (p_target_role = 'all' OR role = p_target_role);
END;
$$;

-- 1.2 Secure `delete_lodge`
-- Ensure search_path is set and logic is robust.
CREATE OR REPLACE FUNCTION public.delete_lodge(lodge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- We rely on auth.uid() which is secure in Supabase for the caller.
  -- The DELETE statement inherently checks ownership via the WHERE clause.
  DELETE FROM public.lodges
  WHERE id = lodge_id AND landlord_id = auth.uid();
END;
$$;

-- 1.3 Secure `delete_own_user`
-- Ensure search_path is set.
CREATE OR REPLACE FUNCTION public.delete_own_user()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_user_id uuid;
BEGIN
  current_user_id := auth.uid();
  
  -- Double check we have a user
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'No authenticated user found.';
  END IF;

  -- 1. Delete all files in 'secure-docs' bucket belonging to this user
  DELETE FROM storage.objects 
  WHERE owner = current_user_id;

  -- 2. Delete the user account
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;


-- ------------------------------------------------------------------------------
-- 2. RESTRICT NOTIFICATION CREATION (Prevent Spam)
-- ------------------------------------------------------------------------------

-- 2.1 Revoke the overly permissive INSERT policy
DROP POLICY IF EXISTS "Any authenticated user can insert notifications" ON public.notifications;

-- 2.2 Create a secure RPC for sending inquiries (Student -> Landlord)
-- This allows us to control exactly *what* is inserted.
CREATE OR REPLACE FUNCTION public.send_lodge_inquiry(
    p_lodge_id UUID,
    p_inquiry_type TEXT -- 'call' or 'whatsapp'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_landlord_id UUID;
    v_lodge_title TEXT;
    v_student_name TEXT;
    v_msg TEXT;
BEGIN
    -- 1. Get Lodge & Landlord Info
    SELECT landlord_id, title INTO v_landlord_id, v_lodge_title
    FROM public.lodges
    WHERE id = p_lodge_id;

    IF v_landlord_id IS NULL THEN
        RAISE EXCEPTION 'Lodge not found.';
    END IF;

    -- 2. Get Student Name (Metadata)
    v_student_name := COALESCE(
        (SELECT name FROM public.profiles WHERE id = auth.uid()),
        'A student'
    );

    -- 3. Construct Message
    IF p_inquiry_type = 'whatsapp' THEN
        v_msg := v_student_name || ' clicked to message you on WhatsApp about "' || v_lodge_title || '".';
    ELSE
        v_msg := v_student_name || ' clicked to call you about "' || v_lodge_title || '".';
    END IF;

    -- 4. Insert Notification
    INSERT INTO public.notifications (user_id, title, message, type, link)
    VALUES (
        v_landlord_id,
        'New Inquiry! 🔔',
        v_msg,
        'info',
        '/lodge/' || p_lodge_id
    );

END;
$$;


-- ------------------------------------------------------------------------------
-- 3. PROTECT USER DATA (Profile Privacy)
-- ------------------------------------------------------------------------------

-- 3.1 Drop the global "view all" policy
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;

-- 3.2 Create a more restrictive policy
-- Users can see:
-- 1. Their own profile
-- 2. Landlord profiles (Active business profiles)
-- 3. Student profiles ONLY if they have posted a public Request (Marketplace)
-- 4. Admins can see everyone
CREATE POLICY "Public and Active profiles are viewable"
ON public.profiles FOR SELECT
USING (
    auth.uid() = id -- Own profile
    OR role = 'landlord' -- Landlords are public
    OR (role = 'student' AND EXISTS (SELECT 1 FROM public.requests WHERE student_id = id)) -- Students with active requests
    OR (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin' -- Admins
);


COMMIT;
