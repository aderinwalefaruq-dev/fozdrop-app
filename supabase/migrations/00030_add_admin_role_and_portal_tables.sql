
-- ── 1. Add Admin to user_role enum ───────────────────────────────────────────
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'Admin';

-- ── 2. Add orders_paused to vendors ──────────────────────────────────────────
ALTER TABLE vendors ADD COLUMN IF NOT EXISTS orders_paused boolean NOT NULL DEFAULT false;

-- ── 3. Announcements table ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS announcements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title           text NOT NULL,
  message         text NOT NULL,
  target_audience text NOT NULL DEFAULT 'All',  -- 'Customer','Vendor','Operator','All'
  created_by      uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin full access on announcements"
  ON announcements FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

CREATE POLICY "Authenticated read announcements"
  ON announcements FOR SELECT
  USING (auth.role() = 'authenticated');

-- ── 4. Admin RLS helper — avoids self-referencing the profiles table ──────────
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles
    WHERE id = auth.uid() AND role = 'Admin'
  );
END;
$$;
GRANT EXECUTE ON FUNCTION is_admin() TO authenticated;

-- ── 5. Broad admin SELECT policies on sensitive tables ─────────────────────
-- profiles: admins can read all profiles
CREATE POLICY "Admin reads all profiles"
  ON profiles FOR SELECT
  USING (is_admin());

-- vendors: admins can update any vendor (suspend, pause, edit)
CREATE POLICY "Admin updates any vendor"
  ON vendors FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin deletes any vendor"
  ON vendors FOR DELETE
  USING (is_admin());

-- menus: admins can insert/update/delete any menu item
CREATE POLICY "Admin manages menus"
  ON menus FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- menu_sections: admins can manage
CREATE POLICY "Admin manages menu_sections"
  ON menu_sections FOR ALL
  USING (is_admin())
  WITH CHECK (is_admin());

-- orders: admins can read and update all orders
CREATE POLICY "Admin reads all orders"
  ON orders FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin updates any order"
  ON orders FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- transactions: admins can read and insert
CREATE POLICY "Admin reads all transactions"
  ON transactions FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin inserts transactions"
  ON transactions FOR INSERT
  WITH CHECK (is_admin());

-- wallets: admins can read and update
CREATE POLICY "Admin reads all wallets"
  ON wallets FOR SELECT
  USING (is_admin());

CREATE POLICY "Admin updates any wallet"
  ON wallets FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

-- free_delivery_passes: admins can insert passes for any user
CREATE POLICY "Admin inserts passes"
  ON free_delivery_passes FOR INSERT
  WITH CHECK (is_admin());

CREATE POLICY "Admin reads all passes"
  ON free_delivery_passes FOR SELECT
  USING (is_admin());

-- app_settings: admins can update
CREATE POLICY "Admin updates app_settings"
  ON app_settings FOR UPDATE
  USING (is_admin())
  WITH CHECK (is_admin());

CREATE POLICY "Admin reads app_settings"
  ON app_settings FOR SELECT
  USING (is_admin());
