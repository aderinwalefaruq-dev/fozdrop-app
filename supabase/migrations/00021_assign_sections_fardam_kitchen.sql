
-- Fardam Kitchen sections:
-- Swallow=52e2e5df, Noodles=8fb4c191, Spaghetti=59b636c1
-- Bread & Eggs=098a9767, Snacks & Small Chops=88f39ef1, Cakes=34b534a0, Extras=1678b02a

-- Swallow: Amala, Eba, Fufu, Semo
UPDATE menus SET section_id = '52e2e5df-52be-4ad2-a777-be6eebd80938'
  WHERE id IN (
    '65780b26-ff97-4fc1-b63b-ac4623a84374', -- Amala
    '1a542627-12c8-4985-9503-0f804a471091', -- Eba
    '6b614e30-90eb-41e9-8fff-15db44ac5fdb', -- Fufu
    'fa204b2e-0f3e-4dbc-9aa9-abea20d0d0b9'  -- Semo
  );

-- Noodles
UPDATE menus SET section_id = '8fb4c191-590a-415e-b4ea-ad6374b8885c'
  WHERE id IN (
    '3c5bb904-041b-4b66-b1ee-951446af4652', -- Noodles Hungry Man Chicken
    'f0cc320e-ce1e-469c-a47d-9d0655d29588', -- Noodles Hungry Man Onion
    '91fcb0cf-b61b-41a1-9276-4a16700b9adb', -- Noodles Super pack Chicken
    'd7954627-443e-417d-a42f-98a30924073f', -- Noodles Super pack Onion
    'e8b75000-e2e3-40bd-b6dd-f9fed87ba3c7'  -- Noodles Belle Full
  );

-- Spaghetti
UPDATE menus SET section_id = '59b636c1-7c0c-4110-9a4c-5f4f7253d4e9'
  WHERE id IN (
    '6de36222-9799-48df-adf1-a6251789bbc6', -- Jollof Spaghetti Per pack
    '7e571ad4-c288-4cbd-9433-c63c346d27c3', -- Stir-fry Spaghetti
    '1f0e3421-a82e-455b-898c-92544cd841e0'  -- White Spaghetti Pack
  );

-- Bread & Eggs
UPDATE menus SET section_id = '098a9767-77b7-4316-b8cd-0d5a4b58ef9e'
  WHERE id IN (
    '26b31f2e-378c-4876-9031-d86de7ea42bb', -- Large Bread and Egg
    'd96107cc-b868-4fe4-b9b6-bfab91263cdd', -- Large Egg Butter and Bread
    '5da84eed-799e-45e2-886a-88ac1106da89', -- Small Bread and Egg
    '51555f09-e166-4b41-81ab-1f9971d4e097', -- Small Bread Butter and Egg
    '7444c8c4-b076-4880-85ca-97403f041a31', -- Fried Egg
    '215e60e1-3d7f-476e-9384-634cbc9566c2'  -- Boiled Egg
  );

-- Snacks & Small Chops
UPDATE menus SET section_id = '88f39ef1-2f35-4649-809d-bb7cd3df9748'
  WHERE id IN (
    'b2963286-3dee-4f7c-a65f-731548232511', -- Buns
    '7615885d-d4d4-4668-9cf6-69e2d9a8052c', -- Chin chin Large
    '60bd6db6-bb3a-4353-ba54-7abcde6dfc94', -- Chin chin Small
    'ff40a077-0510-444f-8131-8b5d710c5ab6', -- Doughnut
    '726814e6-bf7c-40f9-8bbe-f5d6f4a185bc', -- Meat pie
    '39831207-ba0a-4b24-9e10-37eb7fc056d5', -- Mosa
    'ef5d9c6f-9089-4cbf-ac0f-9cc41b931bbb', -- Pufpuf
    'bb193137-3a5f-4d79-90f8-6c22534f2560', -- Samosa
    '4f0cd960-db93-42f0-86fc-68134711643f', -- Springrolls
    'bb902134-a359-49c6-afde-f440b075f53d', -- Stick meats
    '2c65984f-1d25-43c2-ad57-3dddd89d8e66', -- Small chops
    'bd65ad7a-b78e-4504-8741-3c6e91f5651a'  -- Chicken kebab
  );

-- Cakes
UPDATE menus SET section_id = '34b534a0-9a1c-4291-a849-4a92b8c24822'
  WHERE id IN (
    'fbdf7d15-2326-4aa1-9969-ad74eab8ac74', -- Birthday Cake
    'b505ae19-e5e1-401b-aedb-2b6d12352a81', -- Birthday Cake Small
    '27c079eb-3705-4b00-89f0-d187408923d9'  -- Birthday Cake Medium
  );

-- Extras
UPDATE menus SET section_id = '1678b02a-8a7f-407c-bb05-63bf74d925a9'
  WHERE id IN (
    '1df766d3-d396-4c72-b042-399c41c9b12c', -- Extra Egusi
    'bca9ebc6-5677-4359-8f38-637fda21aa1d', -- Extra Ewedu
    'e991a42b-048a-46d3-a9aa-6f294afc2141', -- Extra Okro
    '73e0daf0-ac58-4c49-8683-99bd6d23b3ed'  -- Ponmo
  );
