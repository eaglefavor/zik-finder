-- ==================================================
-- 1. Create the Units Table (Child Table)
-- ==================================================
CREATE TABLE IF NOT EXISTS public.lodge_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    lodge_id UUID NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "Self-con", "2 Bedroom Flat"
    price INTEGER NOT NULL,
    total_units INTEGER NOT NULL DEFAULT 1,
    available_units INTEGER NOT NULL DEFAULT 1,
    image_urls TEXT[] DEFAULT '{}', -- Specific photos for this room type
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==================================================
-- 2. Enable Security (RLS)
-- ==================================================
ALTER TABLE public.lodge_units ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view units
CREATE POLICY "Units are viewable by everyone" 
ON public.lodge_units FOR SELECT USING (true);

-- Policy: Landlords can manage units for lodges they own
-- We check if the parent lodge belongs to the current user
CREATE POLICY "Landlords can insert units" 
ON public.lodge_units FOR INSERT 
WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.lodges 
        WHERE id = lodge_id AND landlord_id = auth.uid()
    )
);

CREATE POLICY "Landlords can update units" 
ON public.lodge_units FOR UPDATE 
USING (
    EXISTS (
        SELECT 1 FROM public.lodges 
        WHERE id = lodge_id AND landlord_id = auth.uid()
    )
);

CREATE POLICY "Landlords can delete units" 
ON public.lodge_units FOR DELETE 
USING (
    EXISTS (
        SELECT 1 FROM public.lodges 
        WHERE id = lodge_id AND landlord_id = auth.uid()
    )
);

-- ==================================================
-- 3. Data Migration (Backwards Compatibility)
-- ==================================================
-- We create a default unit for every existing lodge so the data isn't "empty"
DO $$
DECLARE
    r RECORD;
BEGIN
    FOR r IN SELECT * FROM public.lodges LOOP
        IF NOT EXISTS (SELECT 1 FROM public.lodge_units WHERE lodge_id = r.id) THEN
            INSERT INTO public.lodge_units (lodge_id, name, price, total_units, available_units, image_urls)
            VALUES (
                r.id, 
                'Standard Room', 
                r.price, 
                1, 
                CASE WHEN r.status = 'available' THEN 1 ELSE 0 END, 
                r.image_urls
            );
        END IF;
    END LOOP;
END $$;
