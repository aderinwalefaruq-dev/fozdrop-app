
CREATE POLICY "Vendors can create own store"
  ON public.vendors
  FOR INSERT
  TO authenticated
  WITH CHECK (owner_id = auth.uid());
