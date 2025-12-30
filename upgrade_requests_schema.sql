-- Migration: Upgrade requests table for budget ranges and multi-location
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS min_budget INTEGER DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS max_budget INTEGER DEFAULT 0;
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS locations TEXT[] DEFAULT '{}';

-- Migration logic to port old data (optional, but good practice)
UPDATE public.requests 
SET locations = ARRAY[location] 
WHERE locations = '{}' OR locations IS NULL;

-- Budget range can be parsed from budget_range text if needed, but for new records we use columns.
