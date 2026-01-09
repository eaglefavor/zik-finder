-- Remove is_urgent column from requests table
ALTER TABLE public.requests DROP COLUMN IF EXISTS is_urgent;
