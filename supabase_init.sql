-- ==========================================
-- 1. EXTENSIONS & CLEANUP
-- ==========================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ==========================================
-- 2. TABLE DEFINITIONS
-- ==========================================

-- PROFILES: Extends Supabase Auth
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    role TEXT NOT NULL CHECK (role IN ('student', 'landlord', 'admin')) DEFAULT 'student',
    phone_number TEXT,
    is_verified BOOLEAN DEFAULT FALSE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- LODGES: Property Listings
CREATE TABLE IF NOT EXISTS public.lodges (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    location TEXT NOT NULL,
    amenities JSONB DEFAULT '[]'::jsonb,
    image_urls TEXT[] DEFAULT '{}',
    status TEXT NOT NULL CHECK (status IN ('available', 'taken')) DEFAULT 'available',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- VERIFICATION DOCUMENTS: Private ID Cards
CREATE TABLE IF NOT EXISTS public.verification_docs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    id_card_path TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('pending', 'approved')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- REQUESTS: Student Lodge Requests
CREATE TABLE IF NOT EXISTS public.requests (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    location TEXT NOT NULL,
    budget_range TEXT NOT NULL,
    description TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- 3. ROW LEVEL SECURITY (RLS)
-- ==========================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lodges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_docs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.requests ENABLE ROW LEVEL SECURITY;

-- Profiles Policies
CREATE POLICY "Profiles are viewable by everyone" 
ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Lodges Policies
CREATE POLICY "Lodges are viewable by everyone" 
ON public.lodges FOR SELECT USING (true);

CREATE POLICY "Landlords can insert their own lodges" 
ON public.lodges FOR INSERT WITH CHECK (
    auth.uid() = landlord_id AND 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'landlord'
);

CREATE POLICY "Landlords can update their own lodges" 
ON public.lodges FOR UPDATE USING (auth.uid() = landlord_id);

CREATE POLICY "Landlords can delete their own lodges" 
ON public.lodges FOR DELETE USING (auth.uid() = landlord_id);

-- Requests Policies
CREATE POLICY "Requests are viewable by everyone" 
ON public.requests FOR SELECT USING (true);

CREATE POLICY "Students can insert their own requests" 
ON public.requests FOR INSERT WITH CHECK (
    auth.uid() = student_id AND 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'student'
);

CREATE POLICY "Students can delete their own requests" 
ON public.requests FOR DELETE USING (auth.uid() = student_id);

-- Verification Docs Policies
CREATE POLICY "Landlords can view their own docs" 
ON public.verification_docs FOR SELECT USING (
    auth.uid() = landlord_id OR 
    (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

CREATE POLICY "Landlords can upload their own docs" 
ON public.verification_docs FOR INSERT WITH CHECK (auth.uid() = landlord_id);

-- ==========================================
-- 4. TRIGGERS & AUTOMATION
-- ==========================================

-- Function: Auto-verify profile on doc approval
CREATE OR REPLACE FUNCTION public.handle_verification_approval()
RETURNS TRIGGER AS $$
BEGIN
    IF (NEW.status = 'approved' AND OLD.status != 'approved') THEN
        UPDATE public.profiles
        SET is_verified = TRUE
        WHERE id = NEW.landlord_id;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_verification_approved
    AFTER UPDATE ON public.verification_docs
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_verification_approval();

-- Function: Create profile on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, name, role, phone_number)
    VALUES (
        NEW.id, 
        NEW.raw_user_meta_data->>'name',
        COALESCE(NEW.raw_user_meta_data->>'role', 'student'),
        NEW.raw_user_meta_data->>'phone_number'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==========================================
-- 5. STORAGE POLICIES (secure-docs bucket)
-- ==========================================

-- Note: Ensure 'secure-docs' bucket is created first in Supabase Dashboard.
-- These policies apply to the storage.objects table.

CREATE POLICY "Landlords can upload documents to their own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'secure-docs' AND
    (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Owners and Admins can view documents"
ON storage.objects FOR SELECT
TO authenticated
USING (
    bucket_id = 'secure-docs' AND (
        (storage.foldername(name))[1] = auth.uid()::text OR
        (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
    )
);
