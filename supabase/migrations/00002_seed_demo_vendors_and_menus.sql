
-- Seed demo vendors (no owner, platform-created)
INSERT INTO public.vendors (id, name, image, status) VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'Mama Ngozi Kitchen', 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_af3b6744-2a15-4262-a136-56ec180ab725.jpg', 'Open'),
  ('aaaaaaaa-0002-0002-0002-000000000002', 'Campus Buka & Grill', 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_194acc70-051c-42ac-9367-8ddab9d7edc4.jpg', 'Open'),
  ('aaaaaaaa-0003-0003-0003-000000000003', 'Quick Bites Cafeteria', 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_7f51600f-2a89-4073-b787-3a1206a1c98d.jpg', 'Open'),
  ('aaaaaaaa-0004-0004-0004-000000000004', 'Suya Spot & Drinks', 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b9bdbdc7-7425-4c7f-b55d-9489843c6f14.jpg', 'Closed')
ON CONFLICT (id) DO NOTHING;

-- Seed menus for Mama Ngozi Kitchen
INSERT INTO public.menus (vendor_id, item_name, description, price, image, is_active) VALUES
  ('aaaaaaaa-0001-0001-0001-000000000001', 'Jollof Rice + Chicken', 'Smoky party jollof rice served with fried or grilled chicken', 1200.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_267186f1-0b56-4d13-8601-849fa5c3b0d8.jpg', true),
  ('aaaaaaaa-0001-0001-0001-000000000001', 'Fried Rice + Beef', 'Golden fried rice loaded with veggies and tender beef', 1100.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_3860f827-807c-470a-a445-b89e6f415641.jpg', true),
  ('aaaaaaaa-0001-0001-0001-000000000001', 'Zobo Drink (50cl)', 'Chilled zobo infused with ginger and cloves', 250.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_7fc47b15-9489-48eb-8b90-7071a82f9db0.jpg', true);

-- Seed menus for Campus Buka & Grill
INSERT INTO public.menus (vendor_id, item_name, description, price, image, is_active) VALUES
  ('aaaaaaaa-0002-0002-0002-000000000002', 'Puff Puff (5 pcs)', 'Hot, fluffy puff puff — perfect campus snack', 400.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_9ca13f6e-856e-4ecb-967b-79b4d39db837.jpg', true),
  ('aaaaaaaa-0002-0002-0002-000000000002', 'Suya Wrap', 'Grilled suya with sliced onions wrapped in flatbread', 800.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b9bdbdc7-7425-4c7f-b55d-9489843c6f14.jpg', true),
  ('aaaaaaaa-0002-0002-0002-000000000002', 'Jollof Rice Combo', 'Jollof rice with fried plantain and coleslaw', 1350.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_267186f1-0b56-4d13-8601-849fa5c3b0d8.jpg', true);

-- Seed menus for Quick Bites Cafeteria
INSERT INTO public.menus (vendor_id, item_name, description, price, image, is_active) VALUES
  ('aaaaaaaa-0003-0003-0003-000000000003', 'Chicken Fried Rice', 'Classic fried rice with seasoned chicken chunks', 1000.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_3860f827-807c-470a-a445-b89e6f415641.jpg', true),
  ('aaaaaaaa-0003-0003-0003-000000000003', 'Snack Combo (Puff + Drink)', 'Puff puff (3 pcs) paired with bottled water or zobo', 600.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_9ca13f6e-856e-4ecb-967b-79b4d39db837.jpg', true),
  ('aaaaaaaa-0003-0003-0003-000000000003', 'Grilled Suya Plate', 'Spiced beef suya with sliced tomatoes and onions', 950.00, 'https://miaoda-site-img.s3cdn.medo.dev/images/KLing_b9bdbdc7-7425-4c7f-b55d-9489843c6f14.jpg', false);
