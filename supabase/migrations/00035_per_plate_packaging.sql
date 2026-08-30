-- Packaging is now a per-plate choice (Plate A might need a togo box while
-- Plate B doesn't), not a single per-vendor toggle. This records which
-- plate labels within an order were packed, so vendor/operator dashboards
-- can show a packaging indicator on the specific plate rather than the
-- whole order.
--
-- packaging_fee on orders (already existed) continues to hold the total
-- ₦ amount charged for packaging on that order — this column is just the
-- per-plate breakdown of which plates it applies to, e.g.
-- {"Plate A": true, "Plate B": false}.
alter table public.orders
  add column if not exists plate_packaging jsonb not null default '{}'::jsonb;
