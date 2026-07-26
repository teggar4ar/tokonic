alter function public.register_product_image(uuid, text, text, text, integer, integer, integer, smallint)
set schema private;

alter function public.replace_product_image(uuid, text, text, integer, integer, integer)
set schema private;

alter function public.begin_product_deletion(uuid)
set schema private;

alter function public.finalize_product_deletion(uuid, text[])
set schema private;

create function public.register_product_image(
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
language sql
security invoker
set search_path = ''
as $$
  select private.register_product_image(
    p_product_id,
    p_bucket,
    p_object_path,
    p_mime_type,
    p_byte_size,
    p_width,
    p_height,
    p_display_order
  );
$$;

create function public.replace_product_image(
  p_image_id uuid,
  p_object_path text,
  p_mime_type text,
  p_byte_size integer,
  p_width integer,
  p_height integer
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.replace_product_image(
    p_image_id,
    p_object_path,
    p_mime_type,
    p_byte_size,
    p_width,
    p_height
  );
$$;

create function public.begin_product_deletion(p_product_id uuid)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.begin_product_deletion(p_product_id);
$$;

create function public.finalize_product_deletion(
  p_product_id uuid,
  p_cleaned_object_paths text[]
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.finalize_product_deletion(
    p_product_id,
    p_cleaned_object_paths
  );
$$;

revoke all on function private.register_product_image(uuid, text, text, text, integer, integer, integer, smallint) from public, anon;
revoke all on function private.replace_product_image(uuid, text, text, integer, integer, integer) from public, anon;
revoke all on function private.begin_product_deletion(uuid) from public, anon;
revoke all on function private.finalize_product_deletion(uuid, text[]) from public, anon;

grant usage on schema private to authenticated;
grant execute on function private.register_product_image(uuid, text, text, text, integer, integer, integer, smallint) to authenticated;
grant execute on function private.replace_product_image(uuid, text, text, integer, integer, integer) to authenticated;
grant execute on function private.begin_product_deletion(uuid) to authenticated;
grant execute on function private.finalize_product_deletion(uuid, text[]) to authenticated;

revoke all on function public.register_product_image(uuid, text, text, text, integer, integer, integer, smallint) from public, anon;
revoke all on function public.replace_product_image(uuid, text, text, integer, integer, integer) from public, anon;
revoke all on function public.begin_product_deletion(uuid) from public, anon;
revoke all on function public.finalize_product_deletion(uuid, text[]) from public, anon;

grant execute on function public.register_product_image(uuid, text, text, text, integer, integer, integer, smallint) to authenticated;
grant execute on function public.replace_product_image(uuid, text, text, integer, integer, integer) to authenticated;
grant execute on function public.begin_product_deletion(uuid) to authenticated;
grant execute on function public.finalize_product_deletion(uuid, text[]) to authenticated;

create index product_deletion_receipts_seller_id_idx
on public.product_deletion_receipts (seller_id);
