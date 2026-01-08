-- ==============================================================================
-- PHASE 2: ARCHITECTURE & SCALABILITY HARDENING
-- ==============================================================================

BEGIN;

-- ------------------------------------------------------------------------------
-- 0. SCHEMA MIGRATION (Ensure columns exist)
-- ------------------------------------------------------------------------------
-- Add missing columns to requests table if they don't exist
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS min_budget INTEGER DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS max_budget INTEGER DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS locations TEXT[] DEFAULT '{}';

-- Migration logic to port old data (optional, but good practice)
UPDATE public.requests 
SET locations = ARRAY[location] 
WHERE (locations = '{}' OR locations IS NULL) AND location IS NOT NULL;


-- ------------------------------------------------------------------------------
-- 1. DATA INTEGRITY (CHECK CONSTRAINTS)
-- ------------------------------------------------------------------------------

-- 1.1 Lodges Table
-- Ensure price is non-negative.
-- Ensure views are non-negative.
ALTER TABLE public.lodges
ADD CONSTRAINT lodges_price_check CHECK (price >= 0);

ALTER TABLE public.lodges
ADD CONSTRAINT lodges_views_check CHECK (views >= 0);

-- 1.2 Lodge Units Table
-- Ensure consistent inventory numbers.
ALTER TABLE public.lodge_units
ADD CONSTRAINT units_price_check CHECK (price >= 0),
ADD CONSTRAINT units_total_check CHECK (total_units >= 0),
ADD CONSTRAINT units_available_check CHECK (available_units >= 0),
ADD CONSTRAINT units_logic_check CHECK (available_units <= total_units);

-- 1.3 Requests Table
-- Ensure sensible budget ranges.
ALTER TABLE public.requests
ADD CONSTRAINT requests_min_budget_check CHECK (min_budget >= 0),
ADD CONSTRAINT requests_max_budget_check CHECK (max_budget >= 0),
ADD CONSTRAINT requests_budget_logic_check CHECK (
    max_budget = 0 OR max_budget >= min_budget
); -- max_budget = 0 allows for "no max limit" or "unspecified"


-- ------------------------------------------------------------------------------
-- 2. SYSTEM ADMINISTRATION (Admin Promotion RPC)
-- ------------------------------------------------------------------------------

-- Secure function to promote a user to admin.
-- Can ONLY be called by an existing admin.
CREATE OR REPLACE FUNCTION public.promote_user_to_admin(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Authorization Check: Caller must be an admin
    IF (SELECT role FROM public.profiles WHERE id = auth.uid()) != 'admin' THEN
        RAISE EXCEPTION 'Access Denied: Only Admins can promote users.';
    END IF;

    -- 2. Perform Promotion
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = p_user_id;
    
    -- 3. Validation
    IF NOT FOUND THEN
        RAISE EXCEPTION 'User not found.';
    END IF;
END;
$$;


-- ------------------------------------------------------------------------------
-- 3. FUNCTION HARDENING (Refactor SECURITY DEFINER)
-- ------------------------------------------------------------------------------

-- Harden increment_lodge_view by setting search_path
-- It must remain SECURITY DEFINER to allow students to update view counts.
CREATE OR REPLACE FUNCTION public.increment_lodge_view(p_lodge_id UUID, p_viewer_id UUID DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- 1. Update the main counter on the lodge
    UPDATE public.lodges
    SET views = COALESCE(views, 0) + 1
    WHERE id = p_lodge_id;

    -- 2. Log the individual view with timestamp
    INSERT INTO public.lodge_views_log (lodge_id, viewer_id)
    VALUES (p_lodge_id, p_viewer_id);
END;
$$;

COMMIT;