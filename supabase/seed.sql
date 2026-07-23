insert into auth.users (
  id,
  email,
  raw_user_meta_data
)
values (
  '11111111-1111-4111-8111-111111111111',
  'admin@example.test',
  '{}'
)
on conflict (id) do nothing;

insert into public.sellers (
  auth_user_id,
  store_name,
  store_slug,
  whatsapp_phone,
  origin_label,
  origin_address,
  origin_rajaongkir_id,
  origin_rajaongkir_level
)
values (
  '11111111-1111-4111-8111-111111111111',
  'Tokonic Development',
  'tokonic-development',
  '6280000000000',
  'TAJUR HALANG, BOGOR, JAWA BARAT, 16320',
  'Alamat pengujian nonproduksi',
  '8583',
  'subdistrict'
)
on conflict (auth_user_id) do nothing;
