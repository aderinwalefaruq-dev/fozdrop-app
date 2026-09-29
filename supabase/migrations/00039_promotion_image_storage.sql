-- ============================================================
-- Storage bucket for promotion images (replaces "paste a URL"
-- with a real upload — no more relying on third-party image
-- hosts and their confusing "page link" vs "direct link" mess).
-- ============================================================
insert into storage.buckets (id, name, public)
values ('promotion-images', 'promotion-images', true)
on conflict (id) do nothing;

-- Anyone can view promotion images (they're shown on the public
-- customer-facing home screen carousel).
create policy "Public read access to promotion images"
on storage.objects for select
using (bucket_id = 'promotion-images');

-- Only admins can upload new promotion images. Uses your actual
-- role enum value ('admin', lowercase) rather than 'Admin'.
create policy "Admins can upload promotion images"
on storage.objects for insert
with check (
  bucket_id = 'promotion-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);

-- Only admins can delete/replace promotion images.
create policy "Admins can delete promotion images"
on storage.objects for delete
using (
  bucket_id = 'promotion-images'
  and exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
);
