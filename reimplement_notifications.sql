-- 1. Add 'views' column to lodges table if it doesn't exist
ALTER TABLE public.lodges ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- 2. Create a function to be called from the frontend to increment views
-- This is simpler and more reliable than a trigger-based system for now.
-- It is 'SECURITY INVOKER' (the default), so it runs as the calling user.
CREATE OR REPLACE FUNCTION increment_lodge_view(p_lodge_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE public.lodges
    SET views = views + 1
    WHERE id = p_lodge_id;
END;
$$;

-- 3. Set up basic RLS policies for the notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Drop old policies to ensure a clean slate
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Any authenticated user can insert notifications" ON public.notifications;

-- Create fresh policies
CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own notifications" ON public.notifications FOR DELETE USING (auth.uid() = user_id);

-- This is the key change: Allow ANY authenticated user to insert a notification.
-- This is needed so a student can create a notification for a landlord.
-- The actual recipient is determined by the `user_id` column in the INSERT statement.
CREATE POLICY "Any authenticated user can insert notifications" ON public.notifications FOR INSERT WITH CHECK (true);
