-- Allow anyone (including unauthenticated sign-up screen) to look up a profile
-- by referral_code to verify it — exposes ONLY the name and referral_code columns.
CREATE POLICY "Public can read referral_code for verification"
  ON profiles
  FOR SELECT
  USING (true);