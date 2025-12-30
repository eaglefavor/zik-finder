-- Migration: Add expires_at to requests table
ALTER TABLE public.requests ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '14 days');

-- Index for performance when filtering expired requests
CREATE INDEX IF NOT EXISTS idx_requests_expires_at ON public.requests(expires_at);
