-- ==========================================================================
-- Fix: publication-state mutation path
-- 20260726074535 revoked UPDATE (is_published) from authenticated as a
-- deliberate control (publication interacts with the deletion lifecycle),
-- but the TypeScript data layer still wrote is_published through direct
-- table updates, so product edit and unpublish failed with permission
-- denied. This adds the missing narrow lifecycle RPC instead of
-- re-granting the column: set_product_publication repeats ownership
-- verification, locks the product row, rejects products in deletion, and
-- flips only is_published. Direct column access stays revoked.
-- ==========================================================================

create function private.set_product_publication(
  p_product_id uuid,
  p_is_published boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_product public.products%rowtype;
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

  update public.products
  set is_published = p_is_published
  where id = p_product_id
  returning * into v_product;

  return jsonb_build_object(
    'id', v_product.id,
    'seller_id', v_product.seller_id,
    'slug', v_product.slug,
    'name', v_product.name,
    'description', v_product.description,
    'price', v_product.price,
    'stock', v_product.stock,
    'weight_grams', v_product.weight_grams,
    'is_published', v_product.is_published
  );
end;
$$;

create function public.set_product_publication(
  p_product_id uuid,
  p_is_published boolean
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.set_product_publication(p_product_id, p_is_published);
$$;

revoke all on function private.set_product_publication(uuid, boolean) from public, anon;
revoke all on function public.set_product_publication(uuid, boolean) from public, anon;
grant execute on function private.set_product_publication(uuid, boolean) to authenticated;
grant execute on function public.set_product_publication(uuid, boolean) to authenticated;
