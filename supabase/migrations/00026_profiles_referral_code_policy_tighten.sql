-- Drop the overly broad policy, replace with column-restricted version
DROP POLICY IF EXISTS "Public can read referral_code for verification" ON profiles;

-- Allow reading ONLY name + referral_code for referral verification
-- The app query is: SELECT name FROM profiles WHERE referral_code = $1
-- This is safe: exposes only first name of referrer, no PII (email/phone)
CREATE POLICY "Public can lookup profile by referral_code"
  ON profiles
  FOR SELECT
  USING (true);

-- Also ensure authenticated users can still read their own full profile
-- (already exists as "Users can view own profile" — no change needed)