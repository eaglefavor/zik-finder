-- Fix Lodge Deletion by enabling Cascade on Foreign Keys

-- 1. Lodge Units
ALTER TABLE lodge_units 
DROP CONSTRAINT IF EXISTS lodge_units_lodge_id_fkey;

ALTER TABLE lodge_units 
ADD CONSTRAINT lodge_units_lodge_id_fkey 
FOREIGN KEY (lodge_id) REFERENCES lodges(id) ON DELETE CASCADE;

-- 2. Reviews
ALTER TABLE reviews 
DROP CONSTRAINT IF EXISTS reviews_lodge_id_fkey;

ALTER TABLE reviews 
ADD CONSTRAINT reviews_lodge_id_fkey 
FOREIGN KEY (lodge_id) REFERENCES lodges(id) ON DELETE CASCADE;

-- 3. Favorites
ALTER TABLE favorites 
DROP CONSTRAINT IF EXISTS favorites_lodge_id_fkey;

ALTER TABLE favorites 
ADD CONSTRAINT favorites_lodge_id_fkey 
FOREIGN KEY (lodge_id) REFERENCES lodges(id) ON DELETE CASCADE;

-- 4. Leads (Inbound & Unlocked)
ALTER TABLE leads 
DROP CONSTRAINT IF EXISTS leads_lodge_id_fkey;

ALTER TABLE leads 
ADD CONSTRAINT leads_lodge_id_fkey 
FOREIGN KEY (lodge_id) REFERENCES lodges(id) ON DELETE CASCADE;

-- 5. Lodge Views Log
ALTER TABLE lodge_views_log 
DROP CONSTRAINT IF EXISTS lodge_views_log_lodge_id_fkey;

ALTER TABLE lodge_views_log 
ADD CONSTRAINT lodge_views_log_lodge_id_fkey 
FOREIGN KEY (lodge_id) REFERENCES lodges(id) ON DELETE CASCADE;

-- 6. Reports
ALTER TABLE reports 
DROP CONSTRAINT IF EXISTS reports_lodge_id_fkey;

ALTER TABLE reports 
ADD CONSTRAINT reports_lodge_id_fkey 
FOREIGN KEY (lodge_id) REFERENCES lodges(id) ON DELETE CASCADE;

-- 7. Unlocked Leads (If it still existed, but we dropped it. Safety check)
-- DROP TABLE IF EXISTS unlocked_leads; -- Done previously
