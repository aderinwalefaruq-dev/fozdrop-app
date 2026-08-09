
-- ALMOND PLUS sections:
-- Rice Dishes = d5001b69, Noodles = 6b84dc49, Protein = 8a736684, Extras = 47aa439b

-- Rice Dishes
UPDATE menus SET section_id = 'd5001b69-677c-4f0a-b04d-20193c692d49'
  WHERE id IN (
    '4631d907-9f3a-4345-9c6f-3fc5ed6490d0', -- Jollof rice
    'b68eede5-2a1d-467e-a40e-aee474752876', -- Ofada
    'e33f7a51-f703-468c-901e-0a8545eedc05'  -- White Rice
  );

-- Noodles / Spaghetti
UPDATE menus SET section_id = '6b84dc49-800d-46f9-adf7-eee90473e052'
  WHERE id IN (
    '60404b93-a04a-455b-9240-c8ef7e1f99ce', -- Spagette
    'e9b1fcc9-600d-47d5-b6b0-7fdac06e0e74'  -- Spaghetti on rice
  );

-- Protein
UPDATE menus SET section_id = '8a736684-ef5d-4912-82df-ae459a4d6e66'
  WHERE id IN (
    '10b42084-9c40-4abf-87ca-299a6e12b3a0', -- Chicken big size
    'a463f537-e9fa-4c36-99d3-80b63fbb7733', -- Chicken small
    '4215b8e6-9953-4512-ada9-2de7038a6415'  -- Chicken medium
  );

-- Extras
UPDATE menus SET section_id = '47aa439b-cccf-4ad2-8ecf-8a8363c7b4aa'
  WHERE id = '2fd93c6a-94b2-495d-a19d-7f7f523f1edd'; -- Plantain/portion
