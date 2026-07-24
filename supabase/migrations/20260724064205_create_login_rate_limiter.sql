create schema if not exists private;

revoke all on schema private from public, anon, authenticated, service_role;

create table public.login_rate_limit_buckets (
  bucket_type text not null,
  key_digest text not null,
  attempt_count integer not null,
  window_started_at timestamptz not null,
  expires_at timestamptz not null,
  primary key (bucket_type, key_digest),
  constraint login_rate_limit_buckets_bucket_type_check
    check (bucket_type in ('ip', 'email')),
  constraint login_rate_limit_buckets_key_digest_check
    check (key_digest ~ '^[0-9a-f]{64}$'),
  constraint login_rate_limit_buckets_attempt_count_check
    check (attempt_count between 1 and 5),
  constraint login_rate_limit_buckets_window_check
    check (expires_at = window_started_at + interval '15 minutes')
);

alter table public.login_rate_limit_buckets enable row level security;

revoke all on table public.login_rate_limit_buckets from public, anon, authenticated, service_role;

create function private.consume_login_rate_limit_bucket(
  p_bucket_type text,
  p_key_digest text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bucket public.login_rate_limit_buckets%rowtype;
begin
  if p_bucket_type not in ('ip', 'email')
    or p_key_digest !~ '^[0-9a-f]{64}$'
    or p_now is null
    or not pg_catalog.isfinite(p_now) then
    raise exception 'invalid login rate limit input';
  end if;

  select *
  into v_bucket
  from public.login_rate_limit_buckets
  where bucket_type = p_bucket_type
    and key_digest = p_key_digest
  for update;

  if not found then
    insert into public.login_rate_limit_buckets (
      bucket_type,
      key_digest,
      attempt_count,
      window_started_at,
      expires_at
    )
    values (
      p_bucket_type,
      p_key_digest,
      1,
      p_now,
      p_now + interval '15 minutes'
    )
    returning * into v_bucket;

    return jsonb_build_object('allowed', true, 'reset_at', v_bucket.expires_at);
  end if;

  if v_bucket.expires_at <= p_now then
    update public.login_rate_limit_buckets
    set attempt_count = 1,
        window_started_at = p_now,
        expires_at = p_now + interval '15 minutes'
    where bucket_type = p_bucket_type
      and key_digest = p_key_digest
    returning * into v_bucket;

    return jsonb_build_object('allowed', true, 'reset_at', v_bucket.expires_at);
  end if;

  if v_bucket.attempt_count < 5 then
    update public.login_rate_limit_buckets
    set attempt_count = attempt_count + 1
    where bucket_type = p_bucket_type
      and key_digest = p_key_digest
    returning * into v_bucket;

    return jsonb_build_object('allowed', true, 'reset_at', v_bucket.expires_at);
  end if;

  return jsonb_build_object('allowed', false, 'reset_at', v_bucket.expires_at);
end;
$$;

create function private.consume_login_rate_limit(
  p_ip_digest text,
  p_email_digest text,
  p_now timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_first_lock bigint;
  v_second_lock bigint;
  v_ip_result jsonb;
  v_email_result jsonb;
begin
  if p_ip_digest !~ '^[0-9a-f]{64}$'
    or p_email_digest !~ '^[0-9a-f]{64}$'
    or p_now is null
    or not pg_catalog.isfinite(p_now) then
    raise exception 'invalid login rate limit input';
  end if;

  v_first_lock := least(
    pg_catalog.hashtextextended('ip:' || p_ip_digest, 0),
    pg_catalog.hashtextextended('email:' || p_email_digest, 0)
  );
  v_second_lock := greatest(
    pg_catalog.hashtextextended('ip:' || p_ip_digest, 0),
    pg_catalog.hashtextextended('email:' || p_email_digest, 0)
  );

  perform pg_catalog.pg_advisory_xact_lock(v_first_lock);
  perform pg_catalog.pg_advisory_xact_lock(v_second_lock);

  v_ip_result := private.consume_login_rate_limit_bucket('ip', p_ip_digest, p_now);
  v_email_result := private.consume_login_rate_limit_bucket('email', p_email_digest, p_now);

  return jsonb_build_object(
    'allowed', (v_ip_result ->> 'allowed')::boolean
      and (v_email_result ->> 'allowed')::boolean,
    'reset_at', greatest(
      (v_ip_result ->> 'reset_at')::timestamptz,
      (v_email_result ->> 'reset_at')::timestamptz
    )
  );
end;
$$;

create function private.delete_login_rate_limit_email_bucket(p_email_digest text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  if p_email_digest !~ '^[0-9a-f]{64}$' then
    raise exception 'invalid login rate limit input';
  end if;

  delete from public.login_rate_limit_buckets
  where bucket_type = 'email'
    and key_digest = p_email_digest;

  get diagnostics v_deleted_count = row_count;
  return jsonb_build_object('deleted_count', v_deleted_count);
end;
$$;

create function private.cleanup_login_rate_limit_buckets(p_now timestamptz)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_deleted_count integer;
begin
  if p_now is null or not pg_catalog.isfinite(p_now) then
    raise exception 'invalid login rate limit input';
  end if;

  delete from public.login_rate_limit_buckets
  where expires_at < p_now - interval '48 hours';

  get diagnostics v_deleted_count = row_count;
  return jsonb_build_object('deleted_count', v_deleted_count);
end;
$$;

create function public.consume_login_rate_limit(
  p_ip_digest text,
  p_email_digest text,
  p_now timestamptz
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.consume_login_rate_limit(p_ip_digest, p_email_digest, p_now);
$$;

create function public.delete_login_rate_limit_email_bucket(p_email_digest text)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.delete_login_rate_limit_email_bucket(p_email_digest);
$$;

create function public.cleanup_login_rate_limit_buckets(p_now timestamptz)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select private.cleanup_login_rate_limit_buckets(p_now);
$$;

revoke all on function private.consume_login_rate_limit_bucket(text, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.consume_login_rate_limit(text, text, timestamptz) from public, anon, authenticated, service_role;
revoke all on function private.delete_login_rate_limit_email_bucket(text) from public, anon, authenticated, service_role;
revoke all on function private.cleanup_login_rate_limit_buckets(timestamptz) from public, anon, authenticated, service_role;
revoke all on function public.consume_login_rate_limit(text, text, timestamptz) from public, anon, authenticated;
revoke all on function public.delete_login_rate_limit_email_bucket(text) from public, anon, authenticated;
revoke all on function public.cleanup_login_rate_limit_buckets(timestamptz) from public, anon, authenticated;

grant execute on function public.consume_login_rate_limit(text, text, timestamptz) to service_role;
grant execute on function public.delete_login_rate_limit_email_bucket(text) to service_role;
grant execute on function public.cleanup_login_rate_limit_buckets(timestamptz) to service_role;
