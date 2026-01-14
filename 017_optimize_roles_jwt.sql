-- ==========================================
-- ZIPS 4.1: OPTIMIZE RLS WITH JWT CLAIMS
-- ==========================================

-- 1. Function to Sync Role to Auth Metadata
-- This avoids the expensive subquery (SELECT role FROM profiles WHERE id = auth.uid()) in every RLS policy.
CREATE OR REPLACE FUNCTION public.sync_role_to_metadata()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Only update if role actually changed
  IF (TG_OP = 'INSERT') OR (OLD.role IS DISTINCT FROM NEW.role) THEN
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('user_role', NEW.role)
    WHERE id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- 2. Trigger on Profiles
DROP TRIGGER IF EXISTS trig_sync_role ON public.profiles;
CREATE TRIGGER trig_sync_role
AFTER INSERT OR UPDATE OF role ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.sync_role_to_metadata();

-- 3. One-Time Backfill for Existing Users
-- We need to populate the metadata for everyone currently in the system.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id, role FROM public.profiles LOOP
    UPDATE auth.users
    SET raw_app_meta_data = 
      COALESCE(raw_app_meta_data, '{}'::jsonb) || 
      jsonb_build_object('user_role', r.role)
    WHERE id = r.id;
  END LOOP;
END $$;
