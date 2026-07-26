-- ==========================================================================
-- TASK-019D: Anon-safe public store profile read
-- The storefront header and catalog need store identity (name, slug, logo)
-- for anonymous buyers. Grants anon a column-limited SELECT on sellers and
-- adds an explicit anon SELECT policy. Contact/origin/address columns stay
-- ungranted so anon reads can never expose operational PII.
-- ==========================================================================

grant select (id, store_name, store_slug, logo_bucket, logo_path)
  on table public.sellers
  to anon;

create policy "Anon can read the public store profile"
on public.sellers
for select
to anon
using (true);
