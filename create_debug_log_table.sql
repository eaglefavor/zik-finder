-- A simple table to log debug messages from triggers or functions.
-- It has no Row Level Security (RLS) so that any role, including 'postgres', can write to it.
CREATE TABLE IF NOT EXISTS public.debug_log (
    id SERIAL PRIMARY KEY,
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
