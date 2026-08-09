-- Add paystack_fee column to transactions for fee tracking
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paystack_fee numeric NOT NULL DEFAULT 0;

-- Add fees_collected to wallets (platform account for fee tracking)
ALTER TABLE wallets ADD COLUMN IF NOT EXISTS fees_collected numeric NOT NULL DEFAULT 0;

-- Add comment for documentation
COMMENT ON COLUMN transactions.paystack_fee IS 'Paystack processing fee deducted from gross charge. wallet credit = amount - paystack_fee';
COMMENT ON COLUMN wallets.fees_collected IS 'Running total of Paystack fees collected across all top-ups for this wallet';
