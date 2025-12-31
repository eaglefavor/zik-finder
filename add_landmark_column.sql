-- Migration: Add landmark to lodges table
ALTER TABLE public.lodges ADD COLUMN IF NOT EXISTS landmark TEXT;

-- Update existing lodges with a default landmark based on location if possible
UPDATE public.lodges SET landmark = 'School Gate' WHERE location = 'Ifite' AND landmark IS NULL;
UPDATE public.lodges SET landmark = 'Amansea Junction' WHERE location = 'Amansea' AND landmark IS NULL;
UPDATE public.lodges SET landmark = 'Temp Site Junction' WHERE location = 'Temp Site' AND landmark IS NULL;
UPDATE public.lodges SET landmark = 'UNIZIK Junction' WHERE location = 'Okpuno' AND landmark IS NULL;
