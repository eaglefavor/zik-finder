-- Table for user favorites
CREATE TABLE IF NOT EXISTS public.favorites (
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    lodge_id UUID NOT NULL REFERENCES public.lodges(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, lodge_id)
);

-- Enable RLS
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own favorites"
ON public.favorites FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can add their own favorites"
ON public.favorites FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own favorites"
ON public.favorites FOR DELETE USING (auth.uid() = user_id);
