-- 022_fix_notification_policy.sql
-- Fix Notification RLS Policy to allow Landlords to notify Students

-- 1. Ensure RLS is enabled
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 2. Drop potential conflicting INSERT policies
-- We want to ensure we start with a clean slate for INSERT permissions
DROP POLICY IF EXISTS "Any authenticated user can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can insert their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Authenticated users can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Insert notifications" ON public.notifications;

-- 3. Create the permissive policy
-- This allows ANY authenticated user to insert a row, regardless of who the 'user_id' (recipient) is.
-- This is essential for the "I have a match" feature where Landlord -> Student.
CREATE POLICY "Any authenticated user can insert notifications"
ON public.notifications
FOR INSERT
TO authenticated
WITH CHECK (true);

-- 4. Grant permissions (just in case they were revoked)
GRANT INSERT ON public.notifications TO authenticated;
GRANT SELECT ON public.notifications TO authenticated;
GRANT UPDATE ON public.notifications TO authenticated;
GRANT DELETE ON public.notifications TO authenticated;
