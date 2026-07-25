drop policy "Owners upload product images" on storage.objects;
drop policy "Owners delete product images" on storage.objects;

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
      and sellers.auth_user_id = (select auth.uid())
  )
);

create policy "Owners delete product images"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'product-images'
  and storage.objects.name ~ '^products/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(jpg|jpeg|png|webp)$'
  and exists (
    select 1
    from public.products
    join public.sellers on sellers.id = products.seller_id
    where products.id = ((storage.foldername(storage.objects.name))[2])::uuid
      and sellers.auth_user_id = (select auth.uid())
  )
);
