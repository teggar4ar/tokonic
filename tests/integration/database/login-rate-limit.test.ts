import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { beforeEach, describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  createAnonClient,
  createAuthenticatedAdminClient,
  createServiceRoleClient,
  readDisposableStackEnvironment,
} from "../helpers/supabase-clients";

const windowStart = "2026-07-24T00:00:00.000Z";
const exactWindowEnd = "2026-07-24T00:15:00.000Z";
const cleanupNow = "2026-07-27T00:00:00.000Z";
const resetNow = "2100-01-01T00:00:00.000Z";

const digests = {
  ipA: "a".repeat(64),
  ipB: "b".repeat(64),
  ipC: "c".repeat(64),
  emailA: "d".repeat(64),
  emailB: "e".repeat(64),
  emailC: "f".repeat(64),
};

type LimiterResult = { allowed: boolean; reset_at: string };
type DeletedResult = { deleted_count: number };
type RpcResult<T> = { data: T | null; error: { message: string } | null };
type Rpc = <T>(name: string, params: Record<string, string>) => PromiseLike<RpcResult<T>>;

function rpcFor(client: SupabaseClient): Rpc {
  return client.rpc.bind(client) as unknown as Rpc;
}

function queryDisposableDatabase<T>(query: string): T[] {
  readDisposableStackEnvironment();
  const databaseUrl = process.env.DB_URL;
  if (!databaseUrl) throw new Error("Missing required Supabase env var \"DB_URL\".");
  const hostname = new URL(databaseUrl).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
    throw new Error("Integration tests require a loopback PostgreSQL URL.");
  }
  const cli = resolve("node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
  const output = execFileSync(
    cli,
    ["db", "query", "--db-url", databaseUrl, "--output-format", "json", query],
    { encoding: "utf8", windowsHide: true },
  );
  return JSON.parse(output) as T[];
}

function readLimiterColumns(): string[] {
  return queryDisposableDatabase<{ column_name: string }>(
    "select column_name from information_schema.columns where table_schema = 'public' and table_name = 'login_rate_limit_buckets' order by column_name",
  ).map(({ column_name }) => column_name);
}

function readFunctionSecurityContract() {
  return queryDisposableDatabase<{
    signature: string;
    schema_name: string;
    function_name: string;
    security_definer: boolean;
    empty_search_path: boolean;
  }>(
    "select p.oid::regprocedure::text as signature, n.nspname as schema_name, p.proname as function_name, p.prosecdef as security_definer, coalesce(p.proconfig, array[]::text[]) = array['search_path=\"\"']::text[] as empty_search_path from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace where p.oid in (pg_catalog.to_regprocedure('public.consume_login_rate_limit(text,text,timestamp with time zone)'), pg_catalog.to_regprocedure('public.delete_login_rate_limit_email_bucket(text)'), pg_catalog.to_regprocedure('public.cleanup_login_rate_limit_buckets(timestamp with time zone)'), pg_catalog.to_regprocedure('private.consume_login_rate_limit_bucket(text,text,timestamp with time zone)'), pg_catalog.to_regprocedure('private.consume_login_rate_limit(text,text,timestamp with time zone)'), pg_catalog.to_regprocedure('private.delete_login_rate_limit_email_bucket(text)'), pg_catalog.to_regprocedure('private.cleanup_login_rate_limit_buckets(timestamp with time zone)')) order by p.oid::regprocedure::text",
  );
}

function readPrivilegeContract() {
  return queryDisposableDatabase<{
    role_name: string;
    private_schema_usage: boolean;
    table_select: boolean;
    table_insert: boolean;
    table_update: boolean;
    table_delete: boolean;
    public_consume_execute: boolean;
    public_delete_execute: boolean;
    public_cleanup_execute: boolean;
    private_consume_execute: boolean;
    private_delete_execute: boolean;
    private_cleanup_execute: boolean;
    private_helper_execute: boolean;
  }>(
    "with roles(role_name, role_oid) as (values ('PUBLIC', 0::oid), ('anon', pg_catalog.to_regrole('anon')::oid), ('authenticated', pg_catalog.to_regrole('authenticated')::oid), ('service_role', pg_catalog.to_regrole('service_role')::oid)) select role_name, pg_catalog.has_schema_privilege(role_oid, 'private', 'USAGE') as private_schema_usage, pg_catalog.has_table_privilege(role_oid, 'public.login_rate_limit_buckets', 'SELECT') as table_select, pg_catalog.has_table_privilege(role_oid, 'public.login_rate_limit_buckets', 'INSERT') as table_insert, pg_catalog.has_table_privilege(role_oid, 'public.login_rate_limit_buckets', 'UPDATE') as table_update, pg_catalog.has_table_privilege(role_oid, 'public.login_rate_limit_buckets', 'DELETE') as table_delete, pg_catalog.has_function_privilege(role_oid, 'public.consume_login_rate_limit(text,text,timestamp with time zone)', 'EXECUTE') as public_consume_execute, pg_catalog.has_function_privilege(role_oid, 'public.delete_login_rate_limit_email_bucket(text)', 'EXECUTE') as public_delete_execute, pg_catalog.has_function_privilege(role_oid, 'public.cleanup_login_rate_limit_buckets(timestamp with time zone)', 'EXECUTE') as public_cleanup_execute, pg_catalog.has_function_privilege(role_oid, 'private.consume_login_rate_limit(text,text,timestamp with time zone)', 'EXECUTE') as private_consume_execute, pg_catalog.has_function_privilege(role_oid, 'private.delete_login_rate_limit_email_bucket(text)', 'EXECUTE') as private_delete_execute, pg_catalog.has_function_privilege(role_oid, 'private.cleanup_login_rate_limit_buckets(timestamp with time zone)', 'EXECUTE') as private_cleanup_execute, pg_catalog.has_function_privilege(role_oid, 'private.consume_login_rate_limit_bucket(text,text,timestamp with time zone)', 'EXECUTE') as private_helper_execute from roles order by role_name",
  );
}

function limiterRpc(client: ReturnType<typeof createServiceRoleClient>) {
  const rpc = rpcFor(client);
  return {
    consume(ipDigest: string, emailDigest: string, now = windowStart) {
      return rpc<LimiterResult>("consume_login_rate_limit", {
        p_ip_digest: ipDigest,
        p_email_digest: emailDigest,
        p_now: now,
      });
    },
    deleteEmail(emailDigest: string) {
      return rpc<DeletedResult>("delete_login_rate_limit_email_bucket", {
        p_email_digest: emailDigest,
      });
    },
    cleanup(now = cleanupNow) {
      return rpc<DeletedResult>("cleanup_login_rate_limit_buckets", { p_now: now });
    },
  };
}

async function expectAllowed(result: RpcResult<LimiterResult>, allowed: boolean) {
  expect(result.error).toBeNull();
  expect(result.data?.allowed).toBe(allowed);
  expect(result.data?.reset_at).toEqual(expect.any(String));
}

async function consumeFive(
  limiter: ReturnType<typeof limiterRpc>,
  ipDigest: string,
  emailDigest: string,
  now = windowStart,
) {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    await expectAllowed(await limiter.consume(ipDigest, emailDigest, now), true);
  }
}

async function expectDeniedForPublicFunctions(client: SupabaseClient) {
  const rpc = rpcFor(client);
  const results = await Promise.all([
    rpc<LimiterResult>("consume_login_rate_limit", {
      p_ip_digest: digests.ipA,
      p_email_digest: digests.emailA,
      p_now: windowStart,
    }),
    rpc<DeletedResult>("delete_login_rate_limit_email_bucket", {
      p_email_digest: digests.emailA,
    }),
    rpc<DeletedResult>("cleanup_login_rate_limit_buckets", { p_now: cleanupNow }),
  ]);
  expect(results.every(({ error }) => error !== null)).toBe(true);
}

describe("PostgreSQL login rate limiter", () => {
  beforeEach(async () => {
    readDisposableStackEnvironment();
    const result = await limiterRpc(createServiceRoleClient()).cleanup(resetNow);
    expect(result.error).toBeNull();
  });

  it("allows five attempts and independently enforces both digest buckets", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    await consumeFive(limiter, digests.ipA, digests.emailA);
    await expectAllowed(await limiter.consume(digests.ipA, digests.emailB), false);
    await expectAllowed(await limiter.consume(digests.ipB, digests.emailA), false);
  });

  it("allows five fresh attempts at the exact fifteen-minute boundary", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    await consumeFive(limiter, digests.ipA, digests.emailA);
    await expectAllowed(await limiter.consume(digests.ipA, digests.emailA), false);
    await consumeFive(limiter, digests.ipA, digests.emailA, exactWindowEnd);
    await expectAllowed(await limiter.consume(digests.ipA, digests.emailA, exactWindowEnd), false);
  });

  it("atomically limits concurrent attempts sharing only an IP digest", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        limiter.consume(digests.ipA, index % 2 === 0 ? digests.emailA : digests.emailB),
      ),
    );
    expect(results.every(({ error }) => error === null)).toBe(true);
    expect(results.filter(({ data }) => data?.allowed).length).toBe(5);
  });

  it("atomically limits concurrent attempts sharing only an email digest", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    const results = await Promise.all(
      Array.from({ length: 12 }, (_, index) =>
        limiter.consume(index % 2 === 0 ? digests.ipA : digests.ipB, digests.emailA),
      ),
    );
    expect(results.every(({ error }) => error === null)).toBe(true);
    expect(results.filter(({ data }) => data?.allowed).length).toBe(5);
  });

  it("isolates unrelated digest keys", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    await consumeFive(limiter, digests.ipA, digests.emailA);
    await expectAllowed(await limiter.consume(digests.ipC, digests.emailC), true);
  });

  it("rejects non-finite operation timestamps", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    expect((await limiter.consume(digests.ipA, digests.emailA, "infinity")).error).not.toBeNull();
    expect((await limiter.cleanup("-infinity")).error).not.toBeNull();
  });

  it("denies all direct table DML and public functions to anon and authenticated clients", async () => {
    const clients = [createAnonClient(), await createAuthenticatedAdminClient()];
    for (const client of clients) {
      const table = (client.from as unknown as (name: string) => {
        select: (columns: string) => PromiseLike<{ error: unknown }>;
        insert: (value: Record<string, unknown>) => PromiseLike<{ error: unknown }>;
        update: (value: Record<string, unknown>) => { eq: (column: string, value: string) => PromiseLike<{ error: unknown }> };
        delete: () => { eq: (column: string, value: string) => PromiseLike<{ error: unknown }> };
      })("login_rate_limit_buckets");
      const results = await Promise.all([
        table.select("*"),
        table.insert({ bucket_type: "ip", key_digest: digests.ipA, attempt_count: 1, window_started_at: windowStart, expires_at: exactWindowEnd }),
        table.update({ attempt_count: 2 }).eq("key_digest", digests.ipA),
        table.delete().eq("key_digest", digests.ipA),
      ]);
      expect(results.every(({ error }) => error !== null)).toBe(true);
      await expectDeniedForPublicFunctions(client);
    }
  });

  it("keeps the private schema and implementation functions inaccessible", async () => {
    const clients = [createAnonClient(), await createAuthenticatedAdminClient(), createServiceRoleClient()];
    for (const client of clients) {
      const privateClient = (client as unknown as { schema: (name: string) => SupabaseClient }).schema("private");
      const result = await rpcFor(privateClient)<LimiterResult>("consume_login_rate_limit", {
        p_ip_digest: digests.ipA,
        p_email_digest: digests.emailA,
        p_now: windowStart,
      });
      expect(result.error).not.toBeNull();
    }
  });

  it("deletes only one email bucket and reports idempotent aggregate counts", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    await consumeFive(limiter, digests.ipA, digests.emailA);
    await expectAllowed(await limiter.consume(digests.ipB, digests.emailB), true);

    const firstDeletion = await limiter.deleteEmail(digests.emailA);
    expect(firstDeletion.error).toBeNull();
    expect(firstDeletion.data).toEqual({ deleted_count: 1 });
    const repeatedDeletion = await limiter.deleteEmail(digests.emailA);
    expect(repeatedDeletion.error).toBeNull();
    expect(repeatedDeletion.data).toEqual({ deleted_count: 0 });
    await expectAllowed(await limiter.consume(digests.ipA, digests.emailC), false);
    await expectAllowed(await limiter.consume(digests.ipC, digests.emailA), true);
    await expectAllowed(await limiter.consume(digests.ipC, digests.emailB), true);
  });

  it("cleans only buckets expired for more than forty-eight hours", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    await limiter.consume(digests.ipA, digests.emailA, "2026-07-24T23:44:59.000Z");
    await consumeFive(limiter, digests.ipB, digests.emailB, "2026-07-24T23:45:00.000Z");
    await limiter.consume(digests.ipC, digests.emailC, "2026-07-24T23:45:01.000Z");
    const exactBoundaryBeforeCleanup = await limiter.consume(
      digests.ipB,
      digests.emailB,
      "2026-07-24T23:45:01.000Z",
    );

    expect(exactBoundaryBeforeCleanup.error).toBeNull();
    expect(exactBoundaryBeforeCleanup.data).toEqual({
      allowed: false,
      reset_at: "2026-07-25T00:00:00+00:00",
    });
    const firstCleanup = await limiter.cleanup();
    expect(firstCleanup.error).toBeNull();
    expect(firstCleanup.data).toEqual({ deleted_count: 2 });
    const repeatedCleanup = await limiter.cleanup();
    expect(repeatedCleanup.error).toBeNull();
    expect(repeatedCleanup.data).toEqual({ deleted_count: 0 });
    const exactBoundaryAfterCleanup = await limiter.consume(
      digests.ipB,
      digests.emailB,
      "2026-07-24T23:45:02.000Z",
    );
    expect(exactBoundaryAfterCleanup.error).toBeNull();
    expect(exactBoundaryAfterCleanup.data).toEqual(exactBoundaryBeforeCleanup.data);
    await expectAllowed(await limiter.consume(digests.ipC, digests.emailC, "2026-07-24T23:45:02.000Z"), true);
  });

  it("uses invoker public wrappers and definer private implementations with empty search paths", () => {
    const functions = readFunctionSecurityContract();

    expect(functions).toHaveLength(7);
    expect(functions.map(({ signature }) => signature).sort()).toEqual([
      "private.cleanup_login_rate_limit_buckets(timestamp with time zone)",
      "private.consume_login_rate_limit(text,text,timestamp with time zone)",
      "private.consume_login_rate_limit_bucket(text,text,timestamp with time zone)",
      "private.delete_login_rate_limit_email_bucket(text)",
      "cleanup_login_rate_limit_buckets(timestamp with time zone)",
      "consume_login_rate_limit(text,text,timestamp with time zone)",
      "delete_login_rate_limit_email_bucket(text)",
    ].sort());
    expect(functions.filter(({ schema_name }) => schema_name === "public").every(
      ({ security_definer, empty_search_path }) => !security_definer && empty_search_path,
    )).toBe(true);
    expect(functions.filter(({ schema_name }) => schema_name === "private").every(
      ({ security_definer, empty_search_path }) => security_definer && empty_search_path,
    )).toBe(true);
  });

  it("grants only the privileges required by invoker wrappers", () => {
    const privileges = readPrivilegeContract();
    const deniedRoles = privileges.filter(({ role_name }) => role_name !== "service_role");
    const serviceRole = privileges.find(({ role_name }) => role_name === "service_role");

    expect(deniedRoles).toHaveLength(3);
    for (const { role_name, ...grants } of deniedRoles) {
      expect(["PUBLIC", "anon", "authenticated"]).toContain(role_name);
      expect(Object.values(grants).every((granted) => !granted)).toBe(true);
    }
    expect(serviceRole).toEqual({
      role_name: "service_role",
      private_schema_usage: true,
      table_select: false,
      table_insert: false,
      table_update: false,
      table_delete: false,
      public_consume_execute: true,
      public_delete_execute: true,
      public_cleanup_execute: true,
      private_consume_execute: true,
      private_delete_execute: true,
      private_cleanup_execute: true,
      private_helper_execute: false,
    });
  });

  it("stores exactly the digest-only limiter columns", () => {
    const fields = readLimiterColumns();
    const forbidden = ["email", "password", "session", "ip", "client_ip", "forwarded_for", "forwarding_headers", "digest_secret"];

    expect(fields).toEqual(["attempt_count", "bucket_type", "expires_at", "key_digest", "window_started_at"]);
    for (const field of forbidden) expect(fields).not.toContain(field);
  });
});
