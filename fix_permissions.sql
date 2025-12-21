-- Allow users to insert their own profile row (required for fallback creation if the automatic trigger fails)
CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
