-- Function to allow a user to delete their own account
-- This must be run in the Supabase SQL Editor

create or replace function delete_own_user()
returns void
language plpgsql
security definer
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

-- Grant execute permission to authenticated users
grant execute on function delete_own_user to authenticated;
