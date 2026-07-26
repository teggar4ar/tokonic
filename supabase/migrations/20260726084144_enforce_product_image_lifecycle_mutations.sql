revoke insert, update, delete on table public.product_images from authenticated;

create function private.delete_product_image(p_image_id uuid)
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

  select * into v_product
  from public.products
  where id = v_image.product_id
  for update;

  if v_product.deletion_started_at is not null then
    raise exception 'product deletion in progress' using errcode = '40001';
  end if;

  delete from public.product_images where id = p_image_id;
  return jsonb_build_object('id', v_image.id, 'product_id', v_image.product_id, 'deleted', true);
end;
$$;

create function public.delete_product_image(p_image_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.delete_product_image(p_image_id);
$$;

revoke all on function private.delete_product_image(uuid) from public, anon;
revoke all on function public.delete_product_image(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.delete_product_image(uuid) to authenticated;
grant execute on function public.delete_product_image(uuid) to authenticated;
