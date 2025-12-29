-- Enable Realtime for notifications table
-- This allows the client to subscribe to changes (INSERT, UPDATE, DELETE)
begin;
  -- Check if publication exists, if not create it (standard supabase setup usually has it)
  -- But usually we just add the table
  alter publication supabase_realtime add table notifications;
commit;
