-- Secure Delete User Function
-- Ensures robust cleanup of storage and database records with security checks.

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
  -- Relying on 'owner' column is standard for Supabase Storage
  DELETE FROM storage.objects 
  WHERE owner = current_user_id;

  -- 2. Delete the user account
  -- This cascades to public.profiles, which cascades to lodges, requests, etc.
  DELETE FROM auth.users WHERE id = current_user_id;
END;
$$;
