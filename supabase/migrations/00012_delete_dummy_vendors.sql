
-- order_items reference orders; orders reference vendors via vendor_id
-- Cascade is set on menus (vendor_id FK), menu_sections (vendor_id FK)
-- Orders don't cascade; delete order_items then orders first

DELETE FROM order_items WHERE order_id IN (
  SELECT id FROM orders WHERE vendor_id IN (
    'aaaaaaaa-0001-0001-0001-000000000001',
    'aaaaaaaa-0002-0002-0002-000000000002',
    'aaaaaaaa-0003-0003-0003-000000000003',
    'aaaaaaaa-0004-0004-0004-000000000004'
  )
);

DELETE FROM orders WHERE vendor_id IN (
  'aaaaaaaa-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0002-0002-000000000002',
  'aaaaaaaa-0003-0003-0003-000000000003',
  'aaaaaaaa-0004-0004-0004-000000000004'
);

DELETE FROM menus WHERE vendor_id IN (
  'aaaaaaaa-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0002-0002-000000000002',
  'aaaaaaaa-0003-0003-0003-000000000003',
  'aaaaaaaa-0004-0004-0004-000000000004'
);

DELETE FROM vendors WHERE id IN (
  'aaaaaaaa-0001-0001-0001-000000000001',
  'aaaaaaaa-0002-0002-0002-000000000002',
  'aaaaaaaa-0003-0003-0003-000000000003',
  'aaaaaaaa-0004-0004-0004-000000000004'
);
