-- 1. Enable Realtime for notifications
begin;
  alter publication supabase_realtime add table notifications;
commit;

-- 2. Ensure views column exists
ALTER TABLE public.lodges ADD COLUMN IF NOT EXISTS views INTEGER DEFAULT 0;

-- 3. Reset RLS Policies for Notifications
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Any authenticated user can insert notifications" ON public.notifications;

-- View: Only own notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

-- Update: Only own notifications (marking as read)
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- Delete: Only own notifications
CREATE POLICY "Users can delete their own notifications" 
ON public.notifications FOR DELETE 
USING (auth.uid() = user_id);

-- Insert: ANY authenticated user (Critical for Request/Lead matching)
CREATE POLICY "Any authenticated user can insert notifications" 
ON public.notifications FOR INSERT 
WITH CHECK (true);
