-- Drop all existing INSERT policies on notifications to avoid conflicts
DROP POLICY IF EXISTS "Any authenticated user can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "postgres can insert notifications" ON public.notifications;

-- Create a policy for authenticated users (e.g., student viewing a lodge)
CREATE POLICY "Any authenticated user can insert notifications" 
ON public.notifications FOR INSERT 
TO authenticated
WITH CHECK (true);

-- Create a specific policy for the 'postgres' role (used by SECURITY DEFINER triggers)
-- This allows the milestone trigger to insert notifications successfully
CREATE POLICY "Postgres role can insert all notifications"
ON public.notifications FOR INSERT
TO postgres
WITH CHECK (true);