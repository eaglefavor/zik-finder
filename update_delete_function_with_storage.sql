create or replace function delete_own_user()
returns void
language plpgsql
security definer
as $$
declare
  current_user_id uuid;
begin
  current_user_id := auth.uid();

  -- 1. Delete all files in 'secure-docs' bucket belonging to this user
  -- The 'path_tokens' column or 'name' column usually contains the path.
  -- Our structure is: user_id/filename.ext
  -- We delete from storage.objects where the owner is the user.
  -- Supabase storage usually tracks ownership via 'owner' column = auth.users.id
  
  delete from storage.objects 
  where owner = current_user_id;

  -- 2. Delete the user account (this will cascade to profiles, lodges, requests, verification_docs)
  delete from auth.users where id = current_user_id;
end;
$$;
