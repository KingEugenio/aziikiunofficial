-- Admin-managed site assets: logo, favicon, and general documents (T&Cs,
-- policy PDFs, etc.) the admin uploads from the new Branding & Files panel.
-- Files themselves live in a public Storage bucket (logo/favicon MUST be
-- publicly readable - they're shown to signed-out visitors); this table is
-- just the metadata index, and RLS on both the table and the bucket
-- restricts writes to admins only (public.is_admin(), migration 0031).
--
-- Only one 'logo' and one 'favicon' row is ever "active" at a time (the
-- app reads the active one); 'document' rows are all active until an admin
-- deletes them - there's no single "the" document.

insert into storage.buckets (id, name, public)
values ('site-assets', 'site-assets', true)
on conflict (id) do nothing;

create table public.site_assets (
  id uuid primary key default gen_random_uuid(),
  kind text not null check (kind in ('logo', 'favicon', 'document')),
  file_name text not null,
  storage_path text not null,
  content_type text not null,
  size_bytes bigint not null,
  is_active boolean not null default true,
  uploaded_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create index site_assets_kind_active_idx on public.site_assets (kind, is_active);

alter table public.site_assets enable row level security;

-- Readable by anyone, including signed-out visitors - the landing page and
-- browser tab need the active logo/favicon before any login happens.
create policy "site_assets_select_all"
  on public.site_assets for select
  to authenticated, anon
  using (true);

create policy "site_assets_write_admin"
  on public.site_assets for all
  using (public.is_admin())
  with check (public.is_admin());

-- Storage RLS: the bucket is public for reads (public.is_admin() gate is
-- pointless for select since public buckets are readable via direct URL
-- regardless - this just keeps the authenticated-client path consistent),
-- but only an admin can write/replace/delete objects in it.
create policy "site_assets_bucket_select"
  on storage.objects for select
  to authenticated, anon
  using (bucket_id = 'site-assets');

create policy "site_assets_bucket_insert_admin"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'site-assets' and public.is_admin());

create policy "site_assets_bucket_update_admin"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());

create policy "site_assets_bucket_delete_admin"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());
