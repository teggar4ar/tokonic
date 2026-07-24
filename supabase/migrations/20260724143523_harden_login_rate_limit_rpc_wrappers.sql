alter function public.consume_login_rate_limit(text, text, timestamptz) security invoker;
alter function public.delete_login_rate_limit_email_bucket(text) security invoker;
alter function public.cleanup_login_rate_limit_buckets(timestamptz) security invoker;

revoke all on schema private from public, anon, authenticated, service_role;
revoke all on function private.consume_login_rate_limit(text, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.delete_login_rate_limit_email_bucket(text) from public, anon, authenticated, service_role;
revoke all on function private.cleanup_login_rate_limit_buckets(timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.consume_login_rate_limit_bucket(text, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.consume_login_rate_limit(text, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.delete_login_rate_limit_email_bucket(text) from public, anon, authenticated, service_role;
revoke all on function public.cleanup_login_rate_limit_buckets(timestamptz) from public, anon, authenticated, service_role;

grant usage on schema private to service_role;
grant execute on function private.consume_login_rate_limit(text, text, timestamptz) to service_role;
grant execute on function private.delete_login_rate_limit_email_bucket(text) to service_role;
grant execute on function private.cleanup_login_rate_limit_buckets(timestamptz) to service_role;
grant execute on function public.consume_login_rate_limit(text, text, timestamptz) to service_role;
grant execute on function public.delete_login_rate_limit_email_bucket(text) to service_role;
grant execute on function public.cleanup_login_rate_limit_buckets(timestamptz) to service_role;
