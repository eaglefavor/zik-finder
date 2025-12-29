-- DANGEROUS: This script resets the entire notifications system.
-- It deletes all existing notifications and re-creates the table/policies.

BEGIN;

-- 1. DROP EVERYTHING
DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can delete their own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Any authenticated user can insert notifications" ON public.notifications;

DROP TABLE IF EXISTS public.notifications CASCADE;

-- 2. RE-CREATE TABLE
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    type TEXT CHECK (type IN ('info', 'success', 'warning', 'error')) DEFAULT 'info',
    is_read BOOLEAN DEFAULT FALSE,
    link TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ENABLE RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- 4. RE-CREATE POLICIES

-- SELECT: Users can only see their own notifications
CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (auth.uid() = user_id);

-- UPDATE: Users can mark their own as read (is_read is the main update target)
CREATE POLICY "Users can update their own notifications" 
ON public.notifications FOR UPDATE 
USING (auth.uid() = user_id);

-- DELETE: Users can delete their own
CREATE POLICY "Users can delete their own notifications" 
ON public.notifications FOR DELETE 
USING (auth.uid() = user_id);

-- INSERT: Any authenticated user can insert (CRITICAL for System/Student -> Landlord)
-- We use WITH CHECK (true) to allow inserting for *other* users (user_id != auth.uid())
CREATE POLICY "Any authenticated user can insert notifications" 
ON public.notifications FOR INSERT 
TO authenticated
WITH CHECK (true);

-- 5. ENABLE REALTIME
-- Check if publication exists first, usually 'supabase_realtime' exists
-- We ignore error if it's already added, or just run the add command
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;

COMMIT;

-- 6. VERIFICATION (Optional)
-- Verify permissions by checking if we can query (should be empty)
-- SELECT count(*) FROM public.notifications;
