-- Supersedes the plate_notes column from 00033 (that modeled "N copies of
-- the same item, each with its own text note" — not what was needed).
--
-- The corrected model: a "plate" is an independent basket of DIFFERENT
-- items from the same vendor (e.g. Plate A = Jollof Rice + Egg + Salad,
-- Plate B = Fufu + Egusi + Beef). Each order_items row now records which
-- plate it belongs to via plate_label, so a single vendor order can
-- contain multiple distinct plates.
--
-- Safe to run whether or not 00033 was ever applied.
alter table public.order_items
  drop column if exists plate_notes;

alter table public.order_items
  add column if not exists plate_label text not null default 'Plate A';
