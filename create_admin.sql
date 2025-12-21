-- Replace 'YOUR_USER_EMAIL' with the email of the user you want to promote to admin
UPDATE public.profiles
SET role = 'admin'
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'YOUR_USER_EMAIL'
);
