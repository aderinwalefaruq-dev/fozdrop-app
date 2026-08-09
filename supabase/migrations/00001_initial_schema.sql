
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================
-- User Roles ENUM
-- =====================
CREATE TYPE public.user_role AS ENUM ('Customer', 'Vendor', 'Operator');

-- =====================
-- Profiles table (synced from auth.users)
-- =====================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  phone_number TEXT DEFAULT '',
  profile_image TEXT DEFAULT '',
  role public.user_role NOT NULL DEFAULT 'Customer',
  student_staff_id TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role (prevents infinite recursion)
CREATE OR REPLACE FUNCTION get_user_role(uid UUID)
RETURNS public.user_role
LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = uid;
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE TO authenticated USING (auth.uid() = id)
  WITH CHECK (role IS NOT DISTINCT FROM get_user_role(auth.uid()));

-- =====================
-- Trigger: auto-insert profile on auth signup
-- =====================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', ''),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'Customer')
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- =====================
-- Vendors
-- =====================
CREATE TABLE public.vendors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  image TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Closed')),
  owner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.vendors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vendors" ON vendors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vendors can update own" ON vendors FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());

-- =====================
-- Menus
-- =====================
CREATE TABLE public.menus (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price NUMERIC(10,2) NOT NULL DEFAULT 0,
  image TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.menus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view menus" ON menus FOR SELECT TO authenticated USING (true);
CREATE POLICY "Vendors can manage own menus" ON menus FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM vendors WHERE id = vendor_id AND owner_id = auth.uid())
  );

-- =====================
-- Campus Dropoff Locations
-- =====================
CREATE TABLE public.campus_dropoff_locations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  location_name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.campus_dropoff_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view locations" ON campus_dropoff_locations FOR SELECT TO authenticated USING (true);

-- Seed campus locations
INSERT INTO public.campus_dropoff_locations (location_name) VALUES
  ('Amina Hostel Porter''s Desk'),
  ('Faculty of Engineering LT 1'),
  ('University Library Gate'),
  ('Main Student Union Building'),
  ('Faculty of Sciences Entrance'),
  ('Sports Complex Gate'),
  ('Medical Sciences Block A'),
  ('Faculty of Arts Admin Office'),
  ('School of Business Car Park'),
  ('New Female Hostel Block C');

-- =====================
-- Wallets (One-to-One with profiles)
-- =====================
CREATE TABLE public.wallets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  customer_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  platform_owner_balance NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own wallet" ON wallets FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can update own wallet" ON wallets FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Auto-create wallet on profile insert
CREATE OR REPLACE FUNCTION handle_new_profile_wallet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.wallets (user_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_profile_created_wallet
  AFTER INSERT ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION handle_new_profile_wallet();

-- =====================
-- Orders
-- =====================
CREATE TABLE public.orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_ref TEXT NOT NULL DEFAULT '',
  customer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vendor_id UUID NOT NULL REFERENCES public.vendors(id) ON DELETE CASCADE,
  runner_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  dropoff_location_id UUID REFERENCES public.campus_dropoff_locations(id),
  location_description TEXT DEFAULT '',
  delivery_notes TEXT DEFAULT '',
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  delivery_fee NUMERIC(12,2) NOT NULL DEFAULT 245.00,
  total_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Pending'
    CHECK (status IN ('Pending', 'Preparing', 'Out for Delivery', 'Arrived at Dropoff', 'Completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers view own orders" ON orders FOR SELECT TO authenticated
  USING (customer_id = auth.uid());

CREATE POLICY "Vendors view their orders" ON orders FOR SELECT TO authenticated
  USING (vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid()));

CREATE POLICY "Operators view assigned orders" ON orders FOR SELECT TO authenticated
  USING (runner_id = auth.uid() OR get_user_role(auth.uid()) = 'Operator');

CREATE POLICY "Customers can place orders" ON orders FOR INSERT TO authenticated
  WITH CHECK (customer_id = auth.uid());

CREATE POLICY "Vendors update order status" ON orders FOR UPDATE TO authenticated
  USING (
    vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid())
    OR runner_id = auth.uid()
    OR get_user_role(auth.uid()) = 'Operator'
  );

-- =====================
-- Order Items (junction for cart items)
-- =====================
CREATE TABLE public.order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_id UUID NOT NULL REFERENCES public.menus(id) ON DELETE CASCADE,
  item_name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Order parties can view items" ON order_items FOR SELECT TO authenticated
  USING (
    order_id IN (
      SELECT id FROM orders
      WHERE customer_id = auth.uid()
        OR vendor_id IN (SELECT id FROM vendors WHERE owner_id = auth.uid())
        OR runner_id = auth.uid()
    )
  );

CREATE POLICY "Customers insert order items" ON order_items FOR INSERT TO authenticated
  WITH CHECK (
    order_id IN (SELECT id FROM orders WHERE customer_id = auth.uid())
  );

-- =====================
-- Transactions
-- =====================
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  wallet_id UUID NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('Debit', 'Credit')),
  reference_id TEXT DEFAULT '',
  description TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own transactions" ON transactions FOR SELECT TO authenticated
  USING (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

CREATE POLICY "Users insert own transactions" ON transactions FOR INSERT TO authenticated
  WITH CHECK (wallet_id IN (SELECT id FROM wallets WHERE user_id = auth.uid()));

-- =====================
-- Support Requests
-- =====================
CREATE TABLE public.support_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  submitted_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.support_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can submit support requests" ON support_requests FOR INSERT TO authenticated
  WITH CHECK (submitted_by = auth.uid());

CREATE POLICY "Users can view own support requests" ON support_requests FOR SELECT TO authenticated
  USING (submitted_by = auth.uid());
