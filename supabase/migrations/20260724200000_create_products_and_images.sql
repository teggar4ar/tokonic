-- ==========================================================================
-- TASK-012: Product schema and RLS
-- Creates products and product_images tables with UUID keys, seller/product
-- foreign keys, integer/bigint checks, unique seller slug, image order/count
-- constraints, indexes, updated_at trigger with immutability guards, RLS,
-- least-privilege grants, published public reads, and explicit owner predicates.
--
-- Migration ordering per TDD §24.2:
--   1. Tables  2. Constraints/indexes  3. Updated-at trigger
--   4. RLS enablement  5. Grants and policies
-- ==========================================================================

-- -------------------------------------------------------------------------
-- 1. TABLES
-- -------------------------------------------------------------------------
create table public.products (
  id uuid primary key default gen_random_uuid(),
  seller_id uuid not null references public.sellers(id) on delete restrict,
  slug text not null check (slug = lower(slug) and slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 255),
  description text not null default '',
  price bigint not null check (price >= 0),
  stock integer not null check (stock >= 0),
  weight_grams integer not null check (weight_grams > 0),
  is_published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint products_seller_slug_unique unique (seller_id, slug)
);

create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  bucket text not null check (char_length(trim(bucket)) > 0),
  object_path text not null unique,
  mime_type text not null check (mime_type in ('image/jpeg', 'image/png', 'image/webp')),
  byte_size integer not null check (byte_size > 0 and byte_size <= 2097152),
  width integer check (width is null or width > 0),
  height integer check (height is null or height > 0),
  display_order smallint not null check (display_order between 0 and 4),
  created_at timestamptz not null default now(),
  constraint product_images_product_order_unique unique (product_id, display_order)
);

-- -------------------------------------------------------------------------
-- 2. INDEXES
-- -------------------------------------------------------------------------
-- Composite index for storefront queries: filter by seller + published, order by newest
create index products_seller_published_created
  on public.products (seller_id, is_published, created_at desc);

-- -------------------------------------------------------------------------
-- 3. UPDATED-AT TRIGGER (with immutability guards)
-- -------------------------------------------------------------------------
create function public.set_product_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.seller_id is distinct from old.seller_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Product identity and creation fields are immutable';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_product_updated_at() from public, anon, authenticated;

create trigger products_set_updated_at
before update on public.products
for each row
execute function public.set_product_updated_at();

-- -------------------------------------------------------------------------
-- 4. RLS ENABLEMENT
-- -------------------------------------------------------------------------
alter table public.products enable row level security;
alter table public.product_images enable row level security;

-- -------------------------------------------------------------------------
-- 5. GRANTS AND POLICIES
-- -------------------------------------------------------------------------

-- === products ===
revoke all on table public.products from anon, authenticated;
grant select on table public.products to anon;
grant select, insert, delete on table public.products to authenticated;
grant update (
  slug, name, description, price, stock, weight_grams, is_published
) on table public.products to authenticated;

-- Anon: published reads only
create policy "Anon can read published products"
on public.products
for select
to anon
using (is_published = true);

-- Authenticated owner: full CRUD on own products
create policy "Sellers can select their own products"
on public.products
for select
to authenticated
using (seller_id in (
  select id from public.sellers where auth_user_id = (select auth.uid())
));

create policy "Sellers can insert their own products"
on public.products
for insert
to authenticated
with check (seller_id in (
  select id from public.sellers where auth_user_id = (select auth.uid())
));

create policy "Sellers can update their own products"
on public.products
for update
to authenticated
using (seller_id in (
  select id from public.sellers where auth_user_id = (select auth.uid())
))
with check (seller_id in (
  select id from public.sellers where auth_user_id = (select auth.uid())
));

create policy "Sellers can delete their own products"
on public.products
for delete
to authenticated
using (seller_id in (
  select id from public.sellers where auth_user_id = (select auth.uid())
));

-- === product_images ===
revoke all on table public.product_images from anon, authenticated;
grant select on table public.product_images to anon;
grant select, insert, update, delete on table public.product_images to authenticated;

-- Anon: images of published products only
create policy "Anon can read images of published products"
on public.product_images
for select
to anon
using (product_id in (
  select id from public.products where is_published = true
));

-- Authenticated owner: full CRUD on own product images
create policy "Sellers can select their own product images"
on public.product_images
for select
to authenticated
using (product_id in (
  select p.id from public.products p
  join public.sellers s on s.id = p.seller_id
  where s.auth_user_id = (select auth.uid())
));

create policy "Sellers can insert their own product images"
on public.product_images
for insert
to authenticated
with check (product_id in (
  select p.id from public.products p
  join public.sellers s on s.id = p.seller_id
  where s.auth_user_id = (select auth.uid())
));

create policy "Sellers can update their own product images"
on public.product_images
for update
to authenticated
using (product_id in (
  select p.id from public.products p
  join public.sellers s on s.id = p.seller_id
  where s.auth_user_id = (select auth.uid())
))
with check (product_id in (
  select p.id from public.products p
  join public.sellers s on s.id = p.seller_id
  where s.auth_user_id = (select auth.uid())
));

create policy "Sellers can delete their own product images"
on public.product_images
for delete
to authenticated
using (product_id in (
  select p.id from public.products p
  join public.sellers s on s.id = p.seller_id
  where s.auth_user_id = (select auth.uid())
));

-- === service_role grants ===
-- service_role bypasses RLS; grant narrowly for privileged server operations
-- (checkout verification, payment stock decrements, integration test setup).
grant select, insert, update, delete on table public.products to service_role;
grant select, insert, update, delete on table public.product_images to service_role;
