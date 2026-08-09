
-- Menu sections table
CREATE TABLE IF NOT EXISTS menu_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id uuid NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE menu_sections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Vendors manage own sections" ON menu_sections
  FOR ALL USING (
    vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid())
  );

CREATE POLICY "Anyone can view sections" ON menu_sections
  FOR SELECT USING (true);

-- Add section_id and prep_time to menus
ALTER TABLE menus
  ADD COLUMN IF NOT EXISTS section_id uuid REFERENCES menu_sections(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS prep_time_mins int;
