-- Drop the restrictive insert policy
DROP POLICY IF EXISTS "Users can insert notifications" ON public.notifications;

-- Create a new, more permissive insert policy
-- This allows any authenticated user (Student) to create a notification for another user (Landlord)
CREATE POLICY "Any authenticated user can insert notifications" 
ON public.notifications FOR INSERT 
TO authenticated
WITH CHECK (true);
