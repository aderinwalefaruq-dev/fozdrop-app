
-- Fardam Kitchen (0418a02c-b9b6-45ff-ab22-23e6c4777fdb)
INSERT INTO menu_sections (vendor_id, name, sort_order) VALUES
  ('0418a02c-b9b6-45ff-ab22-23e6c4777fdb', 'Swallow', 1),
  ('0418a02c-b9b6-45ff-ab22-23e6c4777fdb', 'Noodles', 2),
  ('0418a02c-b9b6-45ff-ab22-23e6c4777fdb', 'Spaghetti', 3),
  ('0418a02c-b9b6-45ff-ab22-23e6c4777fdb', 'Bread & Eggs', 4),
  ('0418a02c-b9b6-45ff-ab22-23e6c4777fdb', 'Snacks & Small Chops', 5),
  ('0418a02c-b9b6-45ff-ab22-23e6c4777fdb', 'Cakes', 6),
  ('0418a02c-b9b6-45ff-ab22-23e6c4777fdb', 'Extras', 7)
RETURNING id, name;
