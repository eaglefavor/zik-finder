-- ==============================================================================
-- ZIPS 5.0: ROOMMATE MATCHER (Free & Safe Edition)
-- ==============================================================================

-- 1. ROOMMATE PROFILES (The Persona)
-- Stores lifestyle habits and bio. Linked 1:1 to public.profiles.
CREATE TABLE IF NOT EXISTS public.roommate_profiles (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    gender TEXT CHECK (gender IN ('Male', 'Female')),
    department TEXT,
    level TEXT, -- 100L, 200L, etc.
    
    -- Hardened Verification (Admin use only)
    student_id_url TEXT, 
    is_student_verified BOOLEAN DEFAULT FALSE,
    
    -- 1. Structured Compatibility (GIN Indexed)
    -- e.g. {"smoke": false, "guests": "weekends", "cleanliness": "high"}
    habits JSONB DEFAULT '{}'::jsonb, 
    
    -- 2. Unstructured "Vibe Check"
    bio TEXT CHECK (char_length(bio) <= 1000), 
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Optimization: Fast Matching
CREATE INDEX IF NOT EXISTS idx_roommate_habits ON public.roommate_profiles USING GIN (habits);

-- 2. ROOMMATE LISTINGS (The Ad)
CREATE TABLE IF NOT EXISTS public.roommate_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    
    -- Type: "have_room" (Host) or "need_room" (Seeker)
    type TEXT NOT NULL CHECK (type IN ('have_room', 'need_room')),
    
    -- Location Privacy (Escrowed Address)
    location_area TEXT NOT NULL, -- "Ifite", "Okpuno"
    landmark TEXT,
    exact_address_notes TEXT, -- Private until Unlock
    
    -- Financials
    rent_per_person INTEGER, 
    payment_period TEXT DEFAULT 'Yearly',
    
    -- Media
    images TEXT[] DEFAULT '{}',
    description TEXT, -- Sanitized free text
    
    -- Trust Anchor (Verified Lodge Linking)
    linked_lodge_id UUID REFERENCES public.lodges(id) ON DELETE SET NULL,
    
    -- Auto-Expiry (14 Days)
    expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days'),
    status TEXT CHECK (status IN ('active', 'filled', 'expired', 'closed')) DEFAULT 'active',
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. ROOMMATE CONNECTIONS (The Handshake)
CREATE TABLE IF NOT EXISTS public.roommate_connections (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    host_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    seeker_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    listing_id UUID NOT NULL REFERENCES public.roommate_listings(id) ON DELETE CASCADE,
    
    status TEXT CHECK (status IN ('pending', 'accepted', 'declined')) DEFAULT 'pending',
    
    seeker_safety_acknowledged BOOLEAN DEFAULT FALSE, -- Must check "I wont pay before viewing"
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate requests
    CONSTRAINT uniq_connection UNIQUE (seeker_id, listing_id)
);

-- ==============================================================================
-- SECURITY: AGGRESSIVE SANITIZER TRIGGER
-- ==============================================================================

CREATE OR REPLACE FUNCTION check_bio_safety()
RETURNS TRIGGER AS $$
DECLARE
    clean_text TEXT;
BEGIN
    -- Normalize common evasion tactics
    clean_text := NEW.bio;
    clean_text := REPLACE(clean_text, 'Zero', '0');
    clean_text := REPLACE(clean_text, 'One', '1');
    clean_text := REPLACE(clean_text, 'Two', '2');
    clean_text := REPLACE(clean_text, 'Three', '3');
    clean_text := REPLACE(clean_text, 'Four', '4');
    clean_text := REPLACE(clean_text, 'Five', '5');
    clean_text := REPLACE(clean_text, 'Six', '6');
    clean_text := REPLACE(clean_text, 'Seven', '7');
    clean_text := REPLACE(clean_text, 'Eight', '8');
    clean_text := REPLACE(clean_text, 'Nine', '9');
    
    -- Strip non-digits to check density
    -- If we find a sequence of 11 digits (Nigerian number length)
    IF (REGEXP_REPLACE(clean_text, '[^0-9]', '', 'g') ~ '\d{11}') THEN
        RAISE EXCEPTION 'Privacy Violation: Please remove phone numbers from your bio. Share contacts only via the Accept button.';
    END IF;

    -- Also apply standard regex replacement for visual safety (masking)
    -- Using the existing regex logic if available, or a simple one here
    NEW.bio := regexp_replace(NEW.bio, '(?:(?:\+?234)|0)\s?[789][01]\d\s?\d{3}\s?\d{4}', '[HIDDEN CONTACT]', 'g');

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to Profiles (Bio)
DROP TRIGGER IF EXISTS trig_safe_roommate_bio ON public.roommate_profiles;
CREATE TRIGGER trig_safe_roommate_bio
BEFORE INSERT OR UPDATE ON public.roommate_profiles
FOR EACH ROW EXECUTE FUNCTION check_bio_safety();

-- Apply to Listings (Description)
CREATE OR REPLACE FUNCTION check_listing_safety()
RETURNS TRIGGER AS $$
DECLARE
    clean_text TEXT;
BEGIN
    clean_text := NEW.description;
    clean_text := REPLACE(clean_text, 'Zero', '0');
    clean_text := REPLACE(clean_text, 'One', '1');
    clean_text := REPLACE(clean_text, 'Two', '2');
    clean_text := REPLACE(clean_text, 'Three', '3');
    clean_text := REPLACE(clean_text, 'Four', '4');
    clean_text := REPLACE(clean_text, 'Five', '5');
    clean_text := REPLACE(clean_text, 'Six', '6');
    clean_text := REPLACE(clean_text, 'Seven', '7');
    clean_text := REPLACE(clean_text, 'Eight', '8');
    clean_text := REPLACE(clean_text, 'Nine', '9');
    
    IF (REGEXP_REPLACE(clean_text, '[^0-9]', '', 'g') ~ '\d{11}') THEN
        RAISE EXCEPTION 'Privacy Violation: Please remove phone numbers from description. Share contacts only via the Accept button.';
    END IF;

    NEW.description := regexp_replace(NEW.description, '(?:(?:\+?234)|0)\s?[789][01]\d\s?\d{3}\s?\d{4}', '[HIDDEN CONTACT]', 'g');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_safe_roommate_listing ON public.roommate_listings;
CREATE TRIGGER trig_safe_roommate_listing
BEFORE INSERT OR UPDATE ON public.roommate_listings
FOR EACH ROW EXECUTE FUNCTION check_listing_safety();


-- ==============================================================================
-- LOGIC: ATOMIC HANDSHAKE (The Swap)
-- ==============================================================================

CREATE OR REPLACE FUNCTION accept_roommate_invitation(p_connection_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER -- Runs with elevated privileges to fetch phone numbers
AS $$
DECLARE
    v_host_id UUID;
    v_seeker_id UUID;
    v_listing_id UUID;
    v_current_user UUID;
    v_host_phone TEXT;
    v_seeker_phone TEXT;
    v_status TEXT;
BEGIN
    v_current_user := auth.uid();

    -- 1. Lock Row & Validate Ownership
    SELECT status, host_id, seeker_id, listing_id 
    INTO v_status, v_host_id, v_seeker_id, v_listing_id
    FROM public.roommate_connections
    WHERE id = p_connection_id
    FOR UPDATE;

    IF v_host_id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', 'Connection not found');
    END IF;

    -- Only the Host can accept
    IF v_host_id != v_current_user THEN
        RETURN jsonb_build_object('success', false, 'message', 'Unauthorized: Only the host can accept');
    END IF;

    IF v_status != 'pending' THEN
        RETURN jsonb_build_object('success', false, 'message', 'Request is already ' || v_status);
    END IF;

    -- 2. Fetch Phone Numbers
    SELECT phone_number INTO v_host_phone FROM public.profiles WHERE id = v_host_id;
    SELECT phone_number INTO v_seeker_phone FROM public.profiles WHERE id = v_seeker_id;

    -- 3. Update Connection Status
    UPDATE public.roommate_connections
    SET status = 'accepted', 
        accepted_at = NOW()
    WHERE id = p_connection_id;

    -- 4. Send Notifications (The Swap)
    
    -- Notify Seeker (with Host Phone)
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
        v_seeker_id, 
        'success',
        'Roommate Request Accepted! 🎉', 
        'The host accepted your request. You can now contact them: ' || COALESCE(v_host_phone, 'No number provided'), 
        'tel:' || COALESCE(v_host_phone, '')
    );

    -- Notify Host (Confirmation)
    INSERT INTO public.notifications (user_id, type, title, message, link)
    VALUES (
        v_host_id, 
        'info',
        'Connection Established', 
        'You accepted the request. You can contact the seeker: ' || COALESCE(v_seeker_phone, 'No number provided'), 
        'tel:' || COALESCE(v_seeker_phone, '')
    );

    -- 5. Return Success
    RETURN jsonb_build_object('success', true, 'seeker_phone', v_seeker_phone);
END;
$$;


-- ==============================================================================
-- RLS POLICIES
-- ==============================================================================

-- 1. roommate_profiles
ALTER TABLE public.roommate_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Profiles viewable by authenticated users" 
ON public.roommate_profiles FOR SELECT TO authenticated USING (true);

CREATE POLICY "Users can insert/update their own profile" 
ON public.roommate_profiles FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 2. roommate_listings
ALTER TABLE public.roommate_listings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Listings viewable by authenticated users" 
ON public.roommate_listings FOR SELECT TO authenticated 
USING (status = 'active' AND expires_at > NOW());

CREATE POLICY "Users can manage their own listings" 
ON public.roommate_listings FOR ALL TO authenticated 
USING (auth.uid() = user_id) 
WITH CHECK (auth.uid() = user_id);

-- 3. roommate_connections
ALTER TABLE public.roommate_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own connections" 
ON public.roommate_connections FOR SELECT TO authenticated 
USING (auth.uid() = host_id OR auth.uid() = seeker_id);

CREATE POLICY "Seekers can create requests" 
ON public.roommate_connections FOR INSERT TO authenticated 
WITH CHECK (auth.uid() = seeker_id);

-- Host updates status via RPC mostly, but we allow update for safety flag or manual decline
CREATE POLICY "Participants can update their connections" 
ON public.roommate_connections FOR UPDATE TO authenticated 
USING (auth.uid() = host_id OR auth.uid() = seeker_id);
