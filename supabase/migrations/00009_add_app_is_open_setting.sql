INSERT INTO app_settings (key, value)
VALUES ('is_open', 'true')
ON CONFLICT (key) DO NOTHING;