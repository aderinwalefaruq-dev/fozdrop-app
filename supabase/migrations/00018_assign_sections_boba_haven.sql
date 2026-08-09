
-- Boba Haven: Bubble Tea=46e237f0, Meals=dcd1e8d5, Add-ons=5e3e2137
-- Delete old stale sections (Standalone Pack bb136278, Swallow 4256efea) - items using them get reassigned first
UPDATE menus SET section_id = 'dcd1e8d5-36b5-44ac-bf55-045da8605d54'
  WHERE id = 'f0bd1b2e-e3b9-4be1-ab25-82ec0fdec5af'; -- Eba → Meals

-- Bubble Tea items
UPDATE menus SET section_id = '46e237f0-b416-420e-8426-fe9e9f50c71b'
  WHERE id IN (
    'e827a7c6-4f0d-450b-a92c-20489943f738', -- Classic milk tea
    'e878b877-a1bd-4136-9760-ffb0d1c83cdd', -- Matcha tea
    '742c971b-fce6-4af5-bb08-67611813036c'  -- Taro Milk Tea
  );

-- Meals
UPDATE menus SET section_id = 'dcd1e8d5-36b5-44ac-bf55-045da8605d54'
  WHERE id = 'fbecfc81-7ca8-4551-954f-d4c45d856cce'; -- Jollof rice and chicken

-- Add-ons
UPDATE menus SET section_id = '5e3e2137-2db1-4e57-9093-4d057c36d83b'
  WHERE id = '9e58692d-1c89-46d2-8220-19a2dacd66d8'; -- Straw

-- Remove stale old sections (no items left on them)
DELETE FROM menu_sections WHERE id IN (
  'bb136278-b229-44f6-89fe-6b06b9046a27', -- Standalone Pack
  '4256efea-1ee2-4e11-acbf-6e93491fc346'  -- Swallow (old)
);
