
-- ALMOND PLUS (6afd5b36-3310-4b83-9cff-3563ab906134)
-- Items: Chicken big/small/medium, Jollof rice, Ofada, Plantain/portion, Spagette, Spaghetti on rice, White Rice
INSERT INTO menu_sections (vendor_id, name, sort_order) VALUES
  ('6afd5b36-3310-4b83-9cff-3563ab906134', 'Rice Dishes', 1),
  ('6afd5b36-3310-4b83-9cff-3563ab906134', 'Noodles', 2),
  ('6afd5b36-3310-4b83-9cff-3563ab906134', 'Protein', 3),
  ('6afd5b36-3310-4b83-9cff-3563ab906134', 'Extras', 4)
RETURNING id, name;
