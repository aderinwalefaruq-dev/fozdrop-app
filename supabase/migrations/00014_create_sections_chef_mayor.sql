
-- Chef Mayor mbd (47ed81fc-2c8f-421b-8509-746120d4f108)
-- Items: Special rice and plantains
INSERT INTO menu_sections (vendor_id, name, sort_order) VALUES
  ('47ed81fc-2c8f-421b-8509-746120d4f108', 'Rice Dishes', 1)
RETURNING id, name;
