-- Grant execute permissions to API roles
GRANT EXECUTE ON FUNCTION public.get_lodges_feed_smart(integer, integer, timestamp with time zone) TO anon, authenticated, service_role;
