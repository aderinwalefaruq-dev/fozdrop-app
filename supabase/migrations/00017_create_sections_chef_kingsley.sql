
-- Chef Kingsley (e4cae206-400c-448d-98c1-354bd7b63965)
INSERT INTO menu_sections (vendor_id, name, sort_order) VALUES
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Rice Dishes', 1),
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Noodles', 2),
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Spaghetti & Pasta', 3),
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Chicken & Grills', 4),
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Bread & Eggs', 5),
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Swallow & Soups', 6),
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Protein Add-ons', 7),
  ('e4cae206-400c-448d-98c1-354bd7b63965', 'Extras', 8)
RETURNING id, name;
