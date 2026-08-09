
-- ── 1. Add referral_code to profiles ────────────────────────────────────────
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referral_code text UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS referred_by   text; -- referral_code of the person who invited them

-- Back-fill a code for every existing profile (6-char alphanumeric, upper-case)
UPDATE profiles
SET referral_code = upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6))
WHERE referral_code IS NULL;

-- Ensure new rows always get a code automatically
CREATE OR REPLACE FUNCTION generate_referral_code()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := upper(substring(replace(gen_random_uuid()::text, '-', ''), 1, 6));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_referral_code ON profiles;
CREATE TRIGGER profiles_referral_code
  BEFORE INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION generate_referral_code();

-- ── 2. Free delivery passes ──────────────────────────────────────────────────
CREATE TABLE free_delivery_passes (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  earned_from  uuid REFERENCES auth.users(id) ON DELETE SET NULL, -- the friend who triggered the reward
  is_used      boolean NOT NULL DEFAULT false,
  expires_at   timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
  used_at      timestamptz,
  order_ref    text,   -- order that consumed this pass
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX free_delivery_passes_user_id ON free_delivery_passes (user_id);
CREATE INDEX free_delivery_passes_expires ON free_delivery_passes (expires_at) WHERE NOT is_used;

ALTER TABLE free_delivery_passes ENABLE ROW LEVEL SECURITY;

-- Owners can read their own passes
CREATE POLICY "User reads own passes"
  ON free_delivery_passes FOR SELECT
  USING (user_id = auth.uid());

-- Service role has full access (Edge Functions)
CREATE POLICY "Service role full access on passes"
  ON free_delivery_passes FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- ── 3. Track which friends have already had their first-order reward claimed ─
CREATE TABLE referral_rewards (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  referee_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  order_id      text NOT NULL,
  rewarded_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (referee_id)   -- one reward per referee, ever
);

ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;

-- Users can see their own referral rewards (as referrer)
CREATE POLICY "Referrer reads own rewards"
  ON referral_rewards FOR SELECT
  USING (referrer_id = auth.uid());

CREATE POLICY "Service role full access on referral_rewards"
  ON referral_rewards FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
