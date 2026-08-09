ALTER TABLE orders DROP CONSTRAINT orders_status_check;
ALTER TABLE orders ADD CONSTRAINT orders_status_check CHECK (
  status = ANY (ARRAY[
    'Pending'::text,
    'Preparing'::text,
    'Out for Delivery'::text,
    'Arrived at Dropoff'::text,
    'Completed'::text,
    'Cancelled'::text
  ])
);