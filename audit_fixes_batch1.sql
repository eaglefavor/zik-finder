-- Fix Function Search Paths (Security)
ALTER FUNCTION public.increment_lodge_views(uuid) SET search_path = public;
ALTER FUNCTION public.update_wallet_timestamp() SET search_path = public;
ALTER FUNCTION public.handle_verification_approval() SET search_path = public;
ALTER FUNCTION public.notify_view_milestones() SET search_path = public;
ALTER FUNCTION public.handle_credit_topup(uuid, integer, numeric, text, integer) SET search_path = public;
ALTER FUNCTION public.get_wallet_stats(uuid) SET search_path = public;
ALTER FUNCTION public.increment_lodge_view(uuid) SET search_path = public;
ALTER FUNCTION public.increment_lodge_view(uuid, uuid) SET search_path = public;
ALTER FUNCTION public.migrate_existing_landlords_to_zips() SET search_path = public;
ALTER FUNCTION public.init_landlord_wallet() SET search_path = public;
ALTER FUNCTION public.submit_landlord_verification(uuid, text, text, text) SET search_path = public;
ALTER FUNCTION public.promote_lodge(uuid, uuid, text) SET search_path = public;
ALTER FUNCTION public.regex_strip_phone_numbers() SET search_path = public;
ALTER FUNCTION public.get_storage_stats() SET search_path = public;
ALTER FUNCTION public.get_lead_cost(numeric) SET search_path = public;
ALTER FUNCTION public.detect_price_dump() SET search_path = public;
ALTER FUNCTION public.handle_new_review() SET search_path = public;
ALTER FUNCTION public.create_inbound_lead(uuid) SET search_path = public;
ALTER FUNCTION public.unlock_student_request(uuid) SET search_path = public;
ALTER FUNCTION public.handle_new_user() SET search_path = public;

-- Fix Unindexed Foreign Keys (Performance)
CREATE INDEX IF NOT EXISTS idx_credit_transactions_landlord_id ON public.credit_transactions(landlord_id);
CREATE INDEX IF NOT EXISTS idx_leads_lodge_id ON public.leads(lodge_id);
CREATE INDEX IF NOT EXISTS idx_leads_request_id ON public.leads(request_id);
CREATE INDEX IF NOT EXISTS idx_lodge_units_lodge_id ON public.lodge_units(lodge_id);
CREATE INDEX IF NOT EXISTS idx_lodge_views_log_viewer_id ON public.lodge_views_log(viewer_id);
CREATE INDEX IF NOT EXISTS idx_monetization_transactions_user_id ON public.monetization_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_reports_landlord_id ON public.reports(landlord_id);
CREATE INDEX IF NOT EXISTS idx_reports_lodge_id ON public.reports(lodge_id);
CREATE INDEX IF NOT EXISTS idx_reports_reporter_id ON public.reports(reporter_id);
CREATE INDEX IF NOT EXISTS idx_requests_student_id ON public.requests(student_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_review_id ON public.review_replies(review_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_user_id ON public.review_replies(user_id);
CREATE INDEX IF NOT EXISTS idx_reviews_lodge_id ON public.reviews(lodge_id);
CREATE INDEX IF NOT EXISTS idx_reviews_student_id ON public.reviews(student_id);
CREATE INDEX IF NOT EXISTS idx_verification_docs_landlord_id ON public.verification_docs(landlord_id);

-- Drop Unused Indexes (Performance)
DROP INDEX IF EXISTS public.idx_lodges_landlord_id;
DROP INDEX IF EXISTS public.idx_lodges_promoted_until;
DROP INDEX IF EXISTS public.idx_lodges_silent_flag;
DROP INDEX IF EXISTS public.idx_requests_expires_at;

-- Enable RLS on Debug Tables (Security)
ALTER TABLE public.debug_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debug_log ENABLE ROW LEVEL SECURITY;
-- Add a default deny policy or admin only policy
-- Check if policy exists first to avoid error, or use DO block?
-- PostgreSQL 9.5+ supports IF NOT EXISTS for policies but older versions or Supabase might vary.
-- Safest is to just try creating. If it fails, it fails (idempotent if name unique).
-- But standard SQL `CREATE POLICY` doesn't have `IF NOT EXISTS` until very recent versions (pg 16+ has it for ON CONFLICT mostly? No wait).
-- I'll just drop if exists then create to be safe and idempotent.

DROP POLICY IF EXISTS "Admins can view debug logs" ON public.debug_logs;
CREATE POLICY "Admins can view debug logs" ON public.debug_logs FOR SELECT TO authenticated USING ((auth.jwt() ->> 'role') = 'service_role');

DROP POLICY IF EXISTS "Admins can view debug log" ON public.debug_log;
CREATE POLICY "Admins can view debug log" ON public.debug_log FOR SELECT TO authenticated USING ((auth.jwt() ->> 'role') = 'service_role');