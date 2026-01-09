-- ==========================================
-- PHASE 1: MONETIZATION SCHEMA UPDATES
-- ==========================================

-- 1. Update verification_docs for Landlord Verification Fee
-- Adding payment tracking to the verification process
ALTER TABLE public.verification_docs 
ADD COLUMN IF NOT EXISTS payment_reference TEXT,
ADD COLUMN IF NOT EXISTS payment_status TEXT CHECK (payment_status IN ('pending', 'success', 'failed')) DEFAULT 'pending';

-- 2. Update requests for "Urgent" Requests
-- Allowing students to mark requests as urgent
ALTER TABLE public.requests 
ADD COLUMN IF NOT EXISTS is_urgent BOOLEAN DEFAULT FALSE;

-- 3. Update lodges for Photography Service
-- Distinguishing lodges with verified/official photography
ALTER TABLE public.lodges 
ADD COLUMN IF NOT EXISTS is_official_photos BOOLEAN DEFAULT FALSE;

-- 4. Create a Transactions Ledger
-- A central place to track all monetary transactions in the system
CREATE TABLE IF NOT EXISTS public.monetization_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount NUMERIC NOT NULL,
    currency TEXT DEFAULT 'NGN',
    reference TEXT NOT NULL UNIQUE, -- Paystack Reference
    purpose TEXT NOT NULL, -- e.g., 'verification_fee', 'urgent_request', 'promoted_listing'
    metadata JSONB DEFAULT '{}'::jsonb, -- Store extra details like lodge_id or request_id
    status TEXT NOT NULL CHECK (status IN ('pending', 'success', 'failed')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS on the transactions table
ALTER TABLE public.monetization_transactions ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view their own transactions
CREATE POLICY "Users can view their own transactions" 
ON public.monetization_transactions FOR SELECT 
USING (auth.uid() = user_id);

-- Policy: Admins can view all transactions
CREATE POLICY "Admins can view all transactions" 
ON public.monetization_transactions FOR SELECT 
USING ((SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin');

-- Policy: System/Server-side insertion (or user via specific flow, usually handled by webhook/server)
-- For now, allowing authenticated users to insert their own records if we do client-side init, 
-- but ideally this is confirmed via webhook. 
CREATE POLICY "Users can insert their own transactions" 
ON public.monetization_transactions FOR INSERT 
WITH CHECK (auth.uid() = user_id);
