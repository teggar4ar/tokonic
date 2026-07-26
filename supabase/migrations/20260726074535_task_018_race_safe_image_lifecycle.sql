alter table public.products
add column deletion_started_at timestamptz;

create table public.product_deletion_receipts (
  product_id uuid primary key,
  seller_id uuid not null references public.sellers(id) on delete cascade,
  slug text not null,
  completed_at timestamptz not null default now()
);

alter table public.product_deletion_receipts enable row level security;
revoke all on table public.product_deletion_receipts from public, anon, authenticated;
grant select, insert, update, delete on table public.product_deletion_receipts to service_role;

alter table public.products
add constraint products_deletion_unpublished_check
check (deletion_started_at is null or is_published = false);

drop policy "Anon can read published products" on public.products;
create policy "Anon can read published products"
on public.products
for select
to anon
using (is_published = true and deletion_started_at is null);

drop policy "Anon can read images of published products" on public.product_images;
create policy "Anon can read images of published products"
on public.product_images
for select
to anon
using (product_id in (
  select id from public.products
  where is_published = true and deletion_started_at is null
));

drop policy "Owners upload product images" on storage.objects;
create policy "Owners upload product images"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and storage.objects.name ~ '^products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.products
    join public.sellers on sellers.id = products.seller_id
    where products.id = ((storage.foldername(storage.objects.name))[2])::uuid
      and products.deletion_started_at is null
      and sellers.auth_user_id = (select auth.uid())
  )
);

revoke insert on table public.product_images from authenticated;
grant update, delete on table public.product_images to authenticated;
revoke delete on table public.products from authenticated;
revoke update (is_published) on table public.products from authenticated;
grant update (slug, name, description, price, stock, weight_grams) on table public.products to authenticated;

create or replace function public.register_product_image(
  p_product_id uuid,
  p_bucket text,
  p_object_path text,
  p_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer,
  p_display_order smallint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_image public.product_images%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select p.* into v_product
  from public.products p
  join public.sellers s on s.id = p.seller_id
  where p.id = p_product_id
    and s.auth_user_id = (select auth.uid())
  for update of p;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;
  if v_product.deletion_started_at is not null then
    raise exception 'product deletion in progress' using errcode = '40001';
  end if;
  if p_bucket <> 'product-images'
    or p_object_path !~ ('^products/' || p_product_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$')
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 2097152
    or p_width <= 0 or p_height <= 0
    or p_display_order not between 0 and 4 then
    raise exception 'invalid image metadata' using errcode = '22023';
  end if;
  if (select count(*) from public.product_images where product_id = p_product_id) >= 5 then
    raise exception 'image limit reached' using errcode = '23514';
  end if;

  insert into public.product_images (product_id, bucket, object_path, mime_type, byte_size, width, height, display_order)
  values (p_product_id, p_bucket, p_object_path, p_mime_type, p_byte_size, p_width, p_height, p_display_order)
  returning * into v_image;

  return jsonb_build_object(
    'id', v_image.id,
    'product_id', v_image.product_id,
    'bucket', v_image.bucket,
    'object_path', v_image.object_path,
    'mime_type', v_image.mime_type,
    'byte_size', v_image.byte_size,
    'width', v_image.width,
    'height', v_image.height,
    'display_order', v_image.display_order
  );
end;
$$;

create or replace function public.replace_product_image(
  p_image_id uuid,
  p_object_path text,
  p_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_image public.product_images%rowtype;
  v_product public.products%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select pi.* into v_image
  from public.product_images pi
  join public.products p on p.id = pi.product_id
  join public.sellers s on s.id = p.seller_id
  where pi.id = p_image_id
    and s.auth_user_id = (select auth.uid());

  if not found then
    raise exception 'image not found' using errcode = 'P0002';
  end if;

  select * into v_product from public.products where id = v_image.product_id for update;
  if v_product.deletion_started_at is not null then
    raise exception 'product deletion in progress' using errcode = '40001';
  end if;
  if p_object_path = v_image.object_path
    or p_object_path !~ ('^products/' || v_image.product_id::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|png|webp)$')
    or p_mime_type not in ('image/jpeg', 'image/png', 'image/webp')
    or p_byte_size not between 1 and 2097152
    or p_width <= 0 or p_height <= 0 then
    raise exception 'invalid image metadata' using errcode = '22023';
  end if;

  update public.product_images
  set object_path = p_object_path,
      mime_type = p_mime_type,
      byte_size = p_byte_size,
      width = p_width,
      height = p_height
  where id = p_image_id
  returning * into v_image;

  return jsonb_build_object(
    'id', v_image.id,
    'product_id', v_image.product_id,
    'object_path', v_image.object_path,
    'mime_type', v_image.mime_type,
    'byte_size', v_image.byte_size,
    'width', v_image.width,
    'height', v_image.height,
    'display_order', v_image.display_order
  );
end;
$$;

create or replace function public.begin_product_deletion(p_product_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_paths jsonb;
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select p.* into v_product
  from public.products p
  join public.sellers s on s.id = p.seller_id
  where p.id = p_product_id
    and s.auth_user_id = (select auth.uid())
  for update of p;

  if not found then
    raise exception 'product not found' using errcode = 'P0002';
  end if;

  if v_product.deletion_started_at is null then
    update public.products
    set deletion_started_at = statement_timestamp(), is_published = false
    where id = p_product_id;
  end if;

  select coalesce(jsonb_agg(object_path order by display_order), '[]'::jsonb)
  into v_paths
  from public.product_images
  where product_id = p_product_id;

  return jsonb_build_object('product_id', p_product_id, 'slug', v_product.slug, 'object_paths', v_paths);
end;
$$;

create or replace function public.finalize_product_deletion(
  p_product_id uuid,
  p_cleaned_object_paths text[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
  v_expected text[];
begin
  if (select auth.uid()) is null then
    raise exception 'unauthorized' using errcode = '42501';
  end if;

  select p.* into v_product
  from public.products p
  join public.sellers s on s.id = p.seller_id
  where p.id = p_product_id
    and s.auth_user_id = (select auth.uid())
  for update of p;

  if not found then
    select r.slug into v_product.slug
    from public.product_deletion_receipts r
    join public.sellers s on s.id = r.seller_id
    where r.product_id = p_product_id
      and s.auth_user_id = (select auth.uid());
    if not found then
      raise exception 'product not found' using errcode = 'P0002';
    end if;
    return jsonb_build_object('product_id', p_product_id, 'deleted', true, 'slug', v_product.slug);
  end if;
  if v_product.deletion_started_at is null then
    raise exception 'deletion not started' using errcode = '55000';
  end if;

  select coalesce(array_agg(object_path order by object_path), array[]::text[])
  into v_expected
  from public.product_images
  where product_id = p_product_id;

  if v_expected <> coalesce((select array_agg(path order by path) from unnest(p_cleaned_object_paths) path), array[]::text[]) then
    raise exception 'storage cleanup incomplete' using errcode = '55000';
  end if;

  insert into public.product_deletion_receipts (product_id, seller_id, slug)
  values (v_product.id, v_product.seller_id, v_product.slug)
  on conflict (product_id) do nothing;
  delete from public.products where id = p_product_id;
  return jsonb_build_object('product_id', p_product_id, 'deleted', true, 'slug', v_product.slug);
end;
$$;

revoke execute on function public.register_product_image(uuid, text, text, text, integer, integer, integer, smallint) from public, anon;
revoke execute on function public.replace_product_image(uuid, text, text, integer, integer, integer) from public, anon;
revoke execute on function public.begin_product_deletion(uuid) from public, anon;
revoke execute on function public.finalize_product_deletion(uuid, text[]) from public, anon;
grant execute on function public.register_product_image(uuid, text, text, text, integer, integer, integer, smallint) to authenticated;
grant execute on function public.replace_product_image(uuid, text, text, integer, integer, integer) to authenticated;
grant execute on function public.begin_product_deletion(uuid) to authenticated;
grant execute on function public.finalize_product_deletion(uuid, text[]) to authenticated;
