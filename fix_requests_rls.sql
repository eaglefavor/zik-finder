-- Fix RLS for requests table as flagged by Supabase Security Advisor

-- 1. Enable RLS
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to ensure a clean slate
DROP POLICY IF EXISTS "Requests are viewable by everyone" ON public.requests;
DROP POLICY IF EXISTS "Students can insert their own requests" ON public.requests;
DROP POLICY IF EXISTS "Students can delete their own requests" ON public.requests;
DROP POLICY IF EXISTS "Users can update their own requests" ON public.requests;

-- 3. Create robust policies

-- SELECT: Everyone can view requests (Marketplace)
CREATE POLICY "Requests are viewable by everyone" 
ON public.requests FOR SELECT USING (true);

-- INSERT: Only authenticated students can insert their own requests
CREATE POLICY "Students can insert their own requests" 
ON public.requests FOR INSERT WITH CHECK (
    auth.uid() = student_id AND 
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE id = auth.uid() AND role = 'student'
    )
);

-- DELETE: Only the student who created the request can delete it, or an admin
CREATE POLICY "Students can delete their own requests" 
ON public.requests FOR DELETE USING (
    auth.uid() = student_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- UPDATE: Only the student who created the request can update it, or an admin
CREATE POLICY "Students can update their own requests" 
ON public.requests FOR UPDATE USING (
    auth.uid() = student_id OR
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);
