
-- Boba Haven Bubble Tea (f9ea4930-414a-4429-94b5-9b72a2d2f183)
-- Items: Classic milk tea, Eba, Jollof rice and chicken, Matcha tea, Straw, Taro Milk Tea
INSERT INTO menu_sections (vendor_id, name, sort_order) VALUES
  ('f9ea4930-414a-4429-94b5-9b72a2d2f183', 'Bubble Tea', 1),
  ('f9ea4930-414a-4429-94b5-9b72a2d2f183', 'Meals', 2),
  ('f9ea4930-414a-4429-94b5-9b72a2d2f183', 'Add-ons', 3)
RETURNING id, name;
