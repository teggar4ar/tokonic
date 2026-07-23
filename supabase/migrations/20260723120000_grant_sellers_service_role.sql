-- service_role bypasses RLS and is the narrow privileged identity used for
-- verified payment callbacks, retention jobs, operator recovery, and
-- integration-test assertions. Grant it read access to seller settings so the
-- privileged client can perform these non-admin-read operations. Seller
-- mutations remain owner-scoped through the authenticated role + RLS policies.
revoke all on table public.sellers from service_role;
grant select on table public.sellers to service_role;
