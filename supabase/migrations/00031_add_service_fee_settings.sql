
-- Insert delivery_fee and packaging_fee into app_settings if not already present
INSERT INTO app_settings (key, value)
VALUES
  ('delivery_fee',  '199'),
  ('packaging_fee', '200')
ON CONFLICT (key) DO NOTHING;
