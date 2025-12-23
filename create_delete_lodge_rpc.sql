-- Securely delete a lodge if the user owns it
-- Usage: supabase.rpc('delete_lodge', { lodge_id: 'uuid' })

CREATE OR REPLACE FUNCTION public.delete_lodge(lodge_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only delete if the lodge belongs to the authenticated user
  DELETE FROM public.lodges
  WHERE id = lodge_id AND landlord_id = auth.uid();

  -- If no row was deleted, it means either the lodge doesn't exist
  -- or the user doesn't own it. We can optionally raise an error.
  -- For now, we just finish silently (or you can verify ownership first).
END;
$$;
