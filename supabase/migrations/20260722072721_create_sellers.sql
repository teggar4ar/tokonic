create table public.sellers (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null unique references auth.users(id) on delete restrict,
  store_name text not null check (char_length(trim(store_name)) between 1 and 120),
  store_slug text not null unique check (store_slug = lower(store_slug) and store_slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  logo_bucket text,
  logo_path text,
  whatsapp_phone text not null check (whatsapp_phone ~ '^[1-9][0-9]{7,14}$'),
  origin_label text not null check (char_length(trim(origin_label)) between 1 and 255),
  origin_address text not null check (char_length(trim(origin_address)) between 1 and 500),
  origin_rajaongkir_id text not null check (char_length(trim(origin_rajaongkir_id)) > 0),
  origin_rajaongkir_level text not null check (origin_rajaongkir_level in ('district', 'subdistrict')),
  business_timezone text not null default 'Asia/Jakarta',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sellers_logo_pair_check check (
    (logo_bucket is null and logo_path is null)
    or (logo_bucket is not null and logo_path is not null)
  )
);

alter table public.sellers enable row level security;

revoke all on table public.sellers from anon, authenticated;
grant select, update on table public.sellers to authenticated;

create policy "Sellers can select their own row"
on public.sellers
for select
to authenticated
using ((select auth.uid()) = auth_user_id);

create policy "Sellers can update their own row"
on public.sellers
for update
to authenticated
using ((select auth.uid()) = auth_user_id)
with check ((select auth.uid()) = auth_user_id);
