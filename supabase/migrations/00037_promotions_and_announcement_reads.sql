-- ============================================================
-- Promotions (admin-managed ad carousel for the customer home screen)
-- ============================================================
create table if not exists public.promotions (
  id uuid primary key default gen_random_uuid(),
  image_url text not null,
  caption text,
  link_vendor_id uuid references public.vendors(id) on delete set null,
  is_active boolean not null default true,
  sort_order int not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.promotions enable row level security;

create policy "promotions_select" on public.promotions
  for select using (
    is_active = true
    or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
  );

create policy "promotions_admin_write" on public.promotions
  for all
  using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'))
  with check (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- ============================================================
-- Announcement read tracking (per user, per announcement)
-- ============================================================
create table if not exists public.announcement_reads (
  id uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  read_at timestamptz not null default now(),
  unique (announcement_id, user_id)
);

alter table public.announcement_reads enable row level security;

create policy "announcement_reads_manage_own" on public.announcement_reads
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());