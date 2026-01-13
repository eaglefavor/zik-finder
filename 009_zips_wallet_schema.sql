-- ==========================================
-- ZIPS 4.0: WALLET & UNLOCK SYSTEM SCHEMA
-- ==========================================

-- 1. Landlord Wallets (Balance & Reputation)
CREATE TABLE IF NOT EXISTS public.landlord_wallets (
    landlord_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
    balance INT DEFAULT 0, -- Stored in Z-Credits
    z_score INT DEFAULT 50, -- Reputation Score
    is_verified BOOLEAN DEFAULT FALSE, 
    verified_at TIMESTAMP WITH TIME ZONE,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.landlord_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view their own wallet" 
ON public.landlord_wallets FOR SELECT 
USING (auth.uid() = landlord_id);

-- 2. Credit Transactions Ledger
CREATE TABLE IF NOT EXISTS public.credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    amount INT NOT NULL, -- Positive for top-ups, Negative for usage
    type TEXT NOT NULL CHECK (type IN ('purchase', 'unlock_lead', 'bonus', 'penalty', 'legacy_gift')),
    reference_id UUID, -- Link to student_request or lodge
    description TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view their own transactions" 
ON public.credit_transactions FOR SELECT 
USING (auth.uid() = landlord_id);

-- 3. Unlocked Leads (Persistent access to contacts)
CREATE TABLE IF NOT EXISTS public.unlocked_leads (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    landlord_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    request_id UUID REFERENCES public.requests(id) ON DELETE SET NULL, 
    lodge_id UUID REFERENCES public.lodges(id) ON DELETE SET NULL, 
    unlocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    cost_paid INT DEFAULT 0
);

-- Prevention of double-charging (Idempotency)
-- Unique index to handle the compound uniqueness with nulls
CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_unlock ON public.unlocked_leads (
    landlord_id, 
    student_id, 
    COALESCE(request_id, '00000000-0000-0000-0000-000000000000'), 
    COALESCE(lodge_id, '00000000-0000-0000-0000-000000000000')
);

-- Enable RLS
ALTER TABLE public.unlocked_leads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Landlords can view their unlocked leads" 
ON public.unlocked_leads FOR SELECT 
USING (auth.uid() = landlord_id);

-- 4. Integrity Updates for Lodges
ALTER TABLE public.lodges 
ADD COLUMN IF NOT EXISTS is_silently_flagged BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS last_price_edit_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS admin_note TEXT;

-- Create an index for the silent flag
CREATE INDEX IF NOT EXISTS idx_lodges_silent_flag ON public.lodges(is_silently_flagged) WHERE is_silently_flagged = TRUE;

-- 5. Auto-update updated_at for wallets
CREATE OR REPLACE FUNCTION update_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_update_wallet_time ON public.landlord_wallets;
CREATE TRIGGER trig_update_wallet_time
BEFORE UPDATE ON public.landlord_wallets
FOR EACH ROW EXECUTE FUNCTION update_wallet_timestamp();