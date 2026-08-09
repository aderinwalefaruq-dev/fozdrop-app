
-- ── 1. Change default expiry on free_delivery_passes from 7 days → 24 hours ──
ALTER TABLE free_delivery_passes
  ALTER COLUMN expires_at SET DEFAULT (now() + interval '24 hours');

-- ── 2. Auto-expire function: mark passes is_used=false but expired as a no-op
--    (they are already filtered out by `gt('expires_at', now)` in queries).
--    For full hygiene, add a lightweight function + scheduled job that marks
--    passes 'expired' so they can never be accidentally consumed by a
--    race-condition window.  We add an `is_expired` generated column approach
--    via a function that can be called by pg_cron or the Edge layer.
--
--    Strategy: use a DB function callable by the service role to bulk-expire.
--    This is invoked by the place-order function before consuming a pass,
--    guaranteeing stale passes are never used.
CREATE OR REPLACE FUNCTION expire_stale_delivery_passes()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  expired_count integer;
BEGIN
  UPDATE free_delivery_passes
  SET    is_used = true,
         used_at = now()
  WHERE  is_used = false
    AND  expires_at <= now();

  GET DIAGNOSTICS expired_count = ROW_COUNT;
  RETURN expired_count;
END;
$$;

-- Grant service_role permission to call it
GRANT EXECUTE ON FUNCTION expire_stale_delivery_passes() TO service_role;
