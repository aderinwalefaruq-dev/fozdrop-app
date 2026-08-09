
-- Chef Kingsley sections:
-- Rice Dishes=d91809a2, Noodles=53fc79a2, Spaghetti & Pasta=381a23ee
-- Chicken & Grills=a81ddb61, Bread & Eggs=9e8f056a, Swallow & Soups=fe9e3433
-- Protein Add-ons=b972cff2, Extras=3edc680c

-- Rice Dishes
UPDATE menus SET section_id = 'd91809a2-6955-4dea-b53d-81309ddc21db'
  WHERE id IN (
    '9cebea06-9db4-47e3-a809-9500f6f2692b', -- Ecowas Rice & Stew Full pack
    '029c20d4-e814-4e27-808d-bce1f1ef2cea', -- Ecowas Rice & Stew per portion
    'd64d3d01-0232-415b-b110-0f88460ece9a', -- Fried Rice per pack
    '93531a87-cdb4-4cd9-858d-83cd06706b32', -- Fried Rice per portion
    '20008093-e759-4bb5-b21c-d30935eac069', -- Chinese Fried Rice
    '270af037-2ee9-4af9-8061-6578ce106b3e', -- Jollof rice per pack
    'b30098d4-cb05-4484-a276-19156109a565', -- Jollof Rice per portion
    '5ae28305-0db8-462d-a9ba-c080f2cda896', -- White rice Full pack
    'd2c1d07e-0f9e-484c-ab2b-bae63cead3d7', -- White rice per portion
    'fc32af92-b332-4770-8185-1df590955845', -- Catfish pepper soup + White rice
    'e9eed0f5-1041-46b2-8f2f-1af2b3a73472'  -- Chicken Pepper Soup + White Rice
  );

-- Noodles
UPDATE menus SET section_id = '53fc79a2-78c5-4f87-8ffc-dd4dacae11f9'
  WHERE id IN (
    'd3031cbf-3135-480f-ba02-b0a1c8b8e7e9', -- 2 Indomitables + 2 boiled egg + 2 Spanish omelettes
    '42439a52-affd-4938-878e-b08ca3fdd9a1', -- 2 Super Pack + 2 Omelette
    'd070608a-eeb2-416b-85b3-1a84ac9cba9c', -- 3 Super Packs + 2 Boiled Eggs
    '74e77d8f-29ae-4687-95a0-9d93f2c9add9', -- Small Indomitable per one
    '5a696e65-e45d-42b9-96a8-bc3a629fcc96'  -- Super Pack Noodles per one
  );

-- Spaghetti & Pasta
UPDATE menus SET section_id = '381a23ee-99eb-403f-ad7c-b89969bb59da'
  WHERE id IN (
    '6dfaa2cb-79b1-4ae2-911b-3ac9276639a1', -- Jollof spaghetti and Boiled Egg
    'c484b0ab-9e84-4e8f-bb2b-016288b71782', -- Jollof spaghetti and fried egg
    'd675f419-6cd8-4e91-bf3f-14e69f3a6010', -- Penne Alfredo Tomato
    '32258fcc-f398-4a0a-94a1-1cf08ece61f9', -- Penny Alfredo Creamy
    '0e66c409-83ec-450f-b28a-fc643faed623', -- Stir fry spaghetti and egg
    'cb0f06f5-5186-489f-ad47-6150792ad2bf'  -- White sparg and egg
  );

-- Chicken & Grills
UPDATE menus SET section_id = 'a81ddb61-848b-4c19-8448-14379fe1864c'
  WHERE id IN (
    '5138b881-a68e-480f-bf6a-935c448018f8', -- Chicken 3000
    '17873428-e24a-4ec7-ba03-2322f0b7660a', -- Chicken 4000
    '8e93bbdd-cd51-4843-9d34-c034a117f010', -- Chicken 2000
    '5da6b68b-81cd-4e1b-a7a8-321427f3d27b', -- Chicken 1500
    '64e230aa-d1f7-40b4-b964-6a7b23f47258', -- 6 Pieces Chicken wings & chips
    '2db93e60-1fc9-4999-8a19-e90556f57f73', -- Peppered Chicken & Chips
    'd4d04c7f-bd21-4fe1-a00e-16ed86f0b516'  -- Peppered Chicken Wings 6pcs
  );

-- Bread & Eggs
UPDATE menus SET section_id = '9e8f056a-9fbc-4929-9d64-32a539ec08e7'
  WHERE id IN (
    '78db65f4-68f5-49f4-8430-739562ec23a2', -- Big pressed Bread + 2 Eggs
    '3592f4c2-fa49-43d8-83f1-e2a1efefeca2', -- Small Pressed Bread + 2 Eggs
    '22719b28-1289-4de2-b50f-4818b53bea08', -- Fried Egg
    '5cb14164-5830-4c3b-a22b-1bca06ff6af6', -- Boiled egg
    'b607dddb-0c53-4f42-a4dd-14be3be846cb', -- Porsche Egg
    '58a7c84c-0bbd-4080-804d-6e4c72e786b8', -- Scrambled Egg
    '82be8f23-b5f8-4d43-9c25-79687a9ae1cd', -- Spanish Omelette
    '0d14dda6-eff1-4e75-be85-81aaa3bef0d1'  -- Sunnyside Egg
  );

-- Swallow & Soups (includes potato/yam dishes too)
UPDATE menus SET section_id = 'fe9e3433-23b9-4a5b-a16f-cc2e87bca517'
  WHERE id IN (
    '6b593595-63be-40e5-af01-4fc88f18aa95', -- Boiled Potato + Egg Sauce
    'd8017f76-bb19-4cd8-94f5-e5bca4c882a4', -- Boiled Yam + Egg Sauce
    'fc6df1cd-0873-4ac6-ba44-ff8da7769362', -- Fried Sweet Potato + Egg Sauce
    'c9a9252c-b1c7-4315-91e6-e945a8a9420f'  -- Fried Yam + Egg Sauce
  );

-- Protein Add-ons
UPDATE menus SET section_id = 'b972cff2-9fb2-4ab8-ad73-b99ff079c415'
  WHERE id IN (
    '2eceef14-bbc4-428e-b94d-de25d8e362f6', -- Peppered panla fish
    '203915a9-c4e9-4bc3-8ffc-c07f2d0b6066', -- Peppered Ponmo
    'c282fc4a-6923-4ee9-ac93-fb0ffdaaf402', -- Sausage
    '566a9424-7d9c-4a3f-bbfb-f39591d0d9a4', -- Titus Sardine
    '588b7e6b-c176-40b8-b2bc-663dec88ad5e'  -- Other Sardine
  );

-- Extras
UPDATE menus SET section_id = '3edc680c-9658-4de7-bb3b-4aac6d60bd60'
  WHERE id IN (
    'd346ade1-f436-4bd6-8a97-60ee9391a230'  -- Fried Plantain (1 Finger)
  );
