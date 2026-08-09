-- Bank details per vendor user
CREATE TABLE IF NOT EXISTS bank_details (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  bank_name     text NOT NULL,
  account_number text NOT NULL,
  account_name  text NOT NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- Withdrawal requests (status-tracked; balance deducted only on approval)
CREATE TABLE IF NOT EXISTS withdrawal_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id   uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount      numeric(12,2) NOT NULL,
  bank_name   text NOT NULL,
  account_number text NOT NULL,
  account_name   text NOT NULL,
  status      text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending','Approved','Rejected')),
  notes       text,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE bank_details ENABLE ROW LEVEL SECURITY;
ALTER TABLE withdrawal_requests ENABLE ROW LEVEL SECURITY;

-- Vendor can read/write their own bank details
CREATE POLICY "Vendor manages own bank details"
  ON bank_details FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- Vendor can view their own withdrawal requests
CREATE POLICY "Vendor views own withdrawal requests"
  ON withdrawal_requests FOR SELECT
  USING (vendor_id = auth.uid());