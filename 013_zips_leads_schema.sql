-- ==========================================
-- ZIPS 4.0: LEADS & SANITIZATION (PHASE 2)
-- ==========================================

-- 1. Re-structure Leads Tracking
-- Dropping the simple table from Phase 0 in favor of a lifecycle table
DROP TABLE IF EXISTS public.unlocked_leads;

CREATE TABLE IF NOT EXISTS public.leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    type TEXT NOT NULL CHECK (type IN ('inbound', 'request_unlock')), -- inbound = student clicked lodge, request_unlock = landlord clicked student request
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    lodge_id UUID REFERENCES public.lodges(id) ON DELETE SET NULL, -- For inbound
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL, -- For request_unlock
    status TEXT NOT NULL CHECK (status IN ('pending', 'unlocked')) DEFAULT 'pending',
    unlock_cost INT DEFAULT 0, -- Snapshot cost
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unlocked_at TIMESTAMP WITH TIME ZONE,
    
    -- Prevent duplicate leads for the same interaction
    CONSTRAINT uniq_lead_inbound UNIQUE (student_id, lodge_id),
    CONSTRAINT uniq_lead_request UNIQUE (landlord_id, request_id)
);

-- RLS
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can see their own leads" 
ON public.leads FOR SELECT 
USING (auth.uid() = student_id OR auth.uid() = landlord_id);

CREATE POLICY "Students can create inbound leads" 
ON public.leads FOR INSERT 
WITH CHECK (auth.uid() = student_id AND type = 'inbound');

-- 2. Sanitization (The Firewall)
-- Regex to find Nigerian phone numbers (080..., +234...)
CREATE OR REPLACE FUNCTION regex_strip_phone_numbers()
RETURNS TRIGGER AS $$
DECLARE
  -- Matches 08012345678, +23480..., 23480..., 0-8-0... (basic antispoof)
  -- Simplified for performance: (0|\+?234)\s?\d{3}\s?\d{3}\s?\d{4}
  phone_regex TEXT := '(?:(?:\+?234)|0)\s?[789][01]\d\s?\d{3}\s?\d{4}'; 
BEGIN
  -- Sanitize Lodge Title & Description
  IF TG_TABLE_NAME = 'lodges' THEN
    IF NEW.title IS NOT NULL THEN
      NEW.title := regexp_replace(NEW.title, phone_regex, '[HIDDEN CONTACT]', 'g');
    END IF;
    IF NEW.description IS NOT NULL THEN
      NEW.description := regexp_replace(NEW.description, phone_regex, '[HIDDEN CONTACT]', 'g');
    END IF;
  END IF;

  -- Sanitize Profile Name (Don't touch phone_number column!)
  IF TG_TABLE_NAME = 'profiles' THEN
    IF NEW.name IS NOT NULL THEN
      NEW.name := regexp_replace(NEW.name, phone_regex, '[HIDDEN CONTACT]', 'g');
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply Triggers
DROP TRIGGER IF EXISTS trig_sanitize_lodges ON public.lodges;
CREATE TRIGGER trig_sanitize_lodges
BEFORE INSERT OR UPDATE ON public.lodges
FOR EACH ROW EXECUTE FUNCTION regex_strip_phone_numbers();

DROP TRIGGER IF EXISTS trig_sanitize_profiles ON public.profiles;
CREATE TRIGGER trig_sanitize_profiles
BEFORE INSERT OR UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION regex_strip_phone_numbers();

-- 3. One-Time Scrub (Sanitize Existing Data)
UPDATE public.lodges 
SET 
  title = regexp_replace(title, '(?:(?:\+?234)|0)\s?[789][01]\d\s?\d{3}\s?\d{4}', '[HIDDEN CONTACT]', 'g'),
  description = regexp_replace(description, '(?:(?:\+?234)|0)\s?[789][01]\d\s?\d{3}\s?\d{4}', '[HIDDEN CONTACT]', 'g');

UPDATE public.profiles
SET name = regexp_replace(name, '(?:(?:\+?234)|0)\s?[789][01]\d\s?\d{3}\s?\d{4}', '[HIDDEN CONTACT]', 'g');
