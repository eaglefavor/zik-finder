-- ==========================================
-- ZIPS 4.0: INTEGRITY & TRUST (PHASE 4)
-- ==========================================

-- 1. Reviews Table (New)
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lodge_id UUID REFERENCES public.lodges(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS for Reviews
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public read reviews" ON public.reviews FOR SELECT USING (true);
CREATE POLICY "Students can review" ON public.reviews FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 2. Silent Flag Trigger (Price Dump Detection)
CREATE OR REPLACE FUNCTION detect_price_dump()
RETURNS TRIGGER AS $$
DECLARE
  v_threshold NUMERIC := 0.75; -- 25% drop
BEGIN
  -- If Price drops significantly
  IF NEW.price < (OLD.price * v_threshold) THEN
     NEW.is_silently_flagged = TRUE;
     -- Do NOT notify landlord (Silent)
  END IF;
  
  -- Track price edits
  IF NEW.price != OLD.price THEN
     NEW.last_price_edit_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_price_dump ON public.lodges;
CREATE TRIGGER trig_price_dump
BEFORE UPDATE ON public.lodges
FOR EACH ROW EXECUTE FUNCTION detect_price_dump();

-- 3. Z-Score & Kill Switch (Review Trigger)
CREATE OR REPLACE FUNCTION handle_new_review()
RETURNS TRIGGER AS $$
DECLARE
  v_landlord_id UUID;
  v_is_flagged BOOLEAN;
  v_score_change INT := 0;
BEGIN
  -- Get Lodge Info
  SELECT landlord_id, is_silently_flagged INTO v_landlord_id, v_is_flagged 
  FROM public.lodges WHERE id = NEW.lodge_id;

  -- A. Kill Switch Logic
  -- If Lodge is silently flagged AND rating is bad (<= 2)
  IF v_is_flagged AND NEW.rating <= 2 THEN
     
     -- 1. Auto-Suspend Lodge
     UPDATE public.lodges 
     SET status = 'taken', -- Hide it
         is_listing_verified = FALSE,
         admin_note = 'Auto-suspended via ZIPS Kill Switch. Bad review on flagged listing.'
     WHERE id = NEW.lodge_id;

     -- 2. Massive Penalty
     v_score_change := -20;

     -- 3. Notify Admin (Log)
     INSERT INTO public.notifications (user_id, title, message, type, link)
     VALUES (v_landlord_id, 'Listing Suspended ⚠️', 'Your listing has been suspended due to quality concerns reported by students.', 'error', '/profile');

  ELSE
     -- B. Standard Z-Score Logic
     IF NEW.rating >= 4 THEN
        v_score_change := 5; -- Boost
     ELSIF NEW.rating <= 2 THEN
        v_score_change := -5; -- Penalty
     END IF;
  END IF;

  -- Apply Score Change
  IF v_score_change != 0 THEN
    UPDATE public.landlord_wallets 
    SET z_score = GREATEST(0, LEAST(100, z_score + v_score_change))
    WHERE landlord_id = v_landlord_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trig_review_action ON public.reviews;
CREATE TRIGGER trig_review_action
AFTER INSERT ON public.reviews
FOR EACH ROW EXECUTE FUNCTION handle_new_review();
