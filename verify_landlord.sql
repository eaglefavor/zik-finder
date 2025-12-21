-- Use this script to manually verify a landlord if the automatic verification failed
-- or if they were verified before the system update.

-- OPTION 1: Verify a specific user by EMAIL
UPDATE public.profiles
SET is_verified = TRUE
WHERE email = 'your_email@example.com'; -- REPLACE THIS WITH THE ACTUAL EMAIL

-- OPTION 2: Verify ALL Landlords (Use with caution!)
-- UPDATE public.profiles
-- SET is_verified = TRUE
-- WHERE role = 'landlord';

-- Check the status of your user
SELECT * FROM public.profiles WHERE role = 'landlord';
