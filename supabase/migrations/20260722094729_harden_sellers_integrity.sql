create function public.set_seller_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
    or new.auth_user_id is distinct from old.auth_user_id
    or new.created_at is distinct from old.created_at then
    raise exception 'Seller identity and creation fields are immutable';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.set_seller_updated_at() from public, anon, authenticated;

create trigger sellers_set_updated_at
before update on public.sellers
for each row
execute function public.set_seller_updated_at();

revoke update on table public.sellers from authenticated;
grant update (
  store_name,
  store_slug,
  logo_bucket,
  logo_path,
  whatsapp_phone,
  origin_label,
  origin_address,
  origin_rajaongkir_id,
  origin_rajaongkir_level,
  business_timezone
) on table public.sellers to authenticated;

alter table public.sellers
  add constraint sellers_store_name_trimmed_check check (store_name = trim(store_name)) not valid,
  add constraint sellers_origin_label_trimmed_check check (origin_label = trim(origin_label)) not valid,
  add constraint sellers_origin_address_trimmed_check check (origin_address = trim(origin_address)) not valid,
  add constraint sellers_timezone_check check (business_timezone = 'Asia/Jakarta') not valid,
  add constraint sellers_logo_values_check check (
    logo_bucket is null
    or (char_length(trim(logo_bucket)) > 0 and char_length(trim(logo_path)) > 0)
  ) not valid;

alter table public.sellers
  validate constraint sellers_store_name_trimmed_check,
  validate constraint sellers_origin_label_trimmed_check,
  validate constraint sellers_origin_address_trimmed_check,
  validate constraint sellers_timezone_check,
  validate constraint sellers_logo_values_check;
