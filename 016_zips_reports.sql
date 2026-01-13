-- ==========================================
-- ZIPS 4.0: REPORTING SYSTEM
-- ==========================================

-- 1. Reports Table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    reporter_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Student
    lodge_id UUID REFERENCES public.lodges(id) ON DELETE CASCADE,
    landlord_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    reason TEXT NOT NULL CHECK (reason IN ('scam', 'wrong_price', 'misleading', 'rude', 'other')),
    details TEXT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'resolved', 'dismissed')) DEFAULT 'pending',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can create reports" 
ON public.reports FOR INSERT 
WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Admins can view all reports" 
ON public.reports FOR SELECT 
USING (
  (SELECT role FROM public.profiles WHERE id = auth.uid()) = 'admin'
);

-- 2. Report Handler (Trigger)
CREATE OR REPLACE FUNCTION handle_new_report()
RETURNS TRIGGER AS $$
DECLARE
  v_score_penalty INT := 0;
  v_is_flagged BOOLEAN;
BEGIN
  -- Determine Penalty
  IF NEW.reason = 'scam' THEN
     v_score_penalty := -100; -- Immediate Ban Threshold check
  ELSIF NEW.reason = 'misleading' THEN
     v_score_penalty := -20;
  ELSIF NEW.reason = 'rude' THEN
     v_score_penalty := -5;
  END IF;

  -- Apply Z-Score Penalty
  IF v_score_penalty != 0 THEN
    UPDATE public.landlord_wallets 
    SET z_score = GREATEST(0, LEAST(100, z_score + v_score_penalty))
    WHERE landlord_id = NEW.landlord_id;
  END IF;

  -- Check for Kill Switch (Silent Flag + Report)
  SELECT is_silently_flagged INTO v_is_flagged FROM public.lodges WHERE id = NEW.lodge_id;
  
  IF v_is_flagged AND NEW.reason IN ('scam', 'misleading') THEN
     -- Auto-Suspend
     UPDATE public.lodges 
     SET status = 'taken',
         is_listing_verified = FALSE,
         admin_note = 'Auto-suspended via ZIPS Kill Switch. Report received on flagged listing.'
     WHERE id = NEW.lodge_id;
  END IF;

  -- Notify Admin (Insert into notifications for an Admin user? 
  -- Or just let Admin check dashboard. For now, we assume Dashboard.)
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_handle_report ON public.reports;
CREATE TRIGGER trig_handle_report
AFTER INSERT ON public.reports
FOR EACH ROW EXECUTE FUNCTION handle_new_report();
