-- Multi-plate customization: one instruction string per plate/unit ordered,
-- e.g. quantity=3 -> plate_notes = ["no pepper", "extra meat", ""].
alter table public.order_items
  add column if not exists plate_notes jsonb not null default '[]'::jsonb;

-- Scheduled / pre-orders. null = ASAP (current/default behavior), otherwise
-- the customer-requested delivery time.
alter table public.orders
  add column if not exists scheduled_for timestamptz;

create index if not exists idx_orders_scheduled_for
  on public.orders (scheduled_for)
  where scheduled_for is not null;
