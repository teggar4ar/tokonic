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

    expect(await limiter.deleteEmail(digests.emailA)).toEqual({ data: { deleted_count: 1 }, error: null });
    expect(await limiter.deleteEmail(digests.emailA)).toEqual({ data: { deleted_count: 0 }, error: null });
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

    expect(exactBoundaryBeforeCleanup).toEqual({
      data: { allowed: false, reset_at: "2026-07-25T00:00:00+00:00" },
      error: null,
    });
    expect(await limiter.cleanup()).toEqual({ data: { deleted_count: 2 }, error: null });
    expect(await limiter.cleanup()).toEqual({ data: { deleted_count: 0 }, error: null });
    expect(
      await limiter.consume(digests.ipB, digests.emailB, "2026-07-24T23:45:02.000Z"),
    ).toEqual(exactBoundaryBeforeCleanup);
    await expectAllowed(await limiter.consume(digests.ipC, digests.emailC, "2026-07-24T23:45:02.000Z"), true);
  });

  it("exposes exactly the digest-only limiter columns", async () => {
    const environment = readDisposableStackEnvironment();
    const response = await fetch(`${environment.url}/rest/v1/`, {
      headers: { apikey: environment.serviceRoleKey, Authorization: `Bearer ${environment.serviceRoleKey}` },
    });
    const schema = (await response.json()) as { definitions?: Record<string, { properties?: Record<string, unknown> }> };
    const fields = Object.keys(schema.definitions?.login_rate_limit_buckets?.properties ?? {}).sort();
    const forbidden = ["email", "password", "session", "ip", "client_ip", "forwarded_for", "forwarding_headers", "digest_secret"];

    expect(response.ok).toBe(true);
    expect(fields).toEqual(["attempt_count", "bucket_type", "expires_at", "key_digest", "window_started_at"]);
    for (const field of forbidden) expect(fields).not.toContain(field);
  });
});
