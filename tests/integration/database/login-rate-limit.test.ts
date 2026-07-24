import { beforeEach, describe, expect, it } from "vitest";

import {
  createAnonClient,
  createAuthenticatedAdminClient,
  createServiceRoleClient,
  readDisposableStackEnvironment,
} from "../helpers/supabase-clients";

const windowStart = "2026-07-24T00:00:00.000Z";
const afterWindow = "2026-07-24T00:15:01.000Z";
const cleanupNow = "2026-07-27T00:00:00.000Z";

const digests = {
  ipA: "a".repeat(64),
  ipB: "b".repeat(64),
  ipC: "c".repeat(64),
  emailA: "d".repeat(64),
  emailB: "e".repeat(64),
  emailC: "f".repeat(64),
};

type LimiterResult = {
  allowed: boolean;
  reset_at: string;
};

function limiterRpc(client: ReturnType<typeof createServiceRoleClient>) {
  const rpc = client.rpc.bind(client) as unknown as (
    name: string,
    params: Record<string, string>,
  ) => PromiseLike<{ data: LimiterResult | null; error: { message: string } | null }>;

  return {
    consume(ipDigest: string, emailDigest: string, now = windowStart) {
      return rpc("consume_login_rate_limit", {
        p_ip_digest: ipDigest,
        p_email_digest: emailDigest,
        p_now: now,
      });
    },
    deleteEmail(emailDigest: string) {
      return rpc("delete_login_rate_limit_email_bucket", {
        p_email_digest: emailDigest,
      });
    },
    cleanup(now = cleanupNow) {
      return rpc("cleanup_login_rate_limit_buckets", { p_now: now });
    },
  };
}

async function expectAllowed(
  result: Awaited<ReturnType<ReturnType<typeof limiterRpc>["consume"]>>,
  allowed: boolean,
) {
  expect(result.error).toBeNull();
  expect(result.data?.allowed).toBe(allowed);
  expect(result.data?.reset_at).toEqual(expect.any(String));
}

describe("PostgreSQL login rate limiter", () => {
  beforeEach(async () => {
    readDisposableStackEnvironment();
    const result = await limiterRpc(createServiceRoleClient()).cleanup();
    expect(result.error).toBeNull();
  });

  it("allows five attempts and independently enforces both digest buckets", async () => {
    const limiter = limiterRpc(createServiceRoleClient());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectAllowed(await limiter.consume(digests.ipA, digests.emailA), true);
    }

    await expectAllowed(await limiter.consume(digests.ipA, digests.emailB), false);
    await expectAllowed(await limiter.consume(digests.ipB, digests.emailA), false);
  });

  it("atomically prevents concurrent attempts from exceeding five", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    const results = await Promise.all(
      Array.from({ length: 12 }, () => limiter.consume(digests.ipB, digests.emailB)),
    );

    expect(results.every(({ error }) => error === null)).toBe(true);
    expect(results.filter(({ data }) => data?.allowed).length).toBe(5);
    expect(results.filter(({ data }) => data?.allowed === false).length).toBe(7);
  });

  it("resets both buckets after the fifteen-minute window", async () => {
    const limiter = limiterRpc(createServiceRoleClient());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectAllowed(await limiter.consume(digests.ipA, digests.emailA), true);
    }

    await expectAllowed(await limiter.consume(digests.ipA, digests.emailA), false);
    await expectAllowed(await limiter.consume(digests.ipA, digests.emailA, afterWindow), true);
  });

  it("isolates unrelated digest keys", async () => {
    const limiter = limiterRpc(createServiceRoleClient());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectAllowed(await limiter.consume(digests.ipA, digests.emailA), true);
    }

    await expectAllowed(await limiter.consume(digests.ipC, digests.emailC), true);
  });

  it("denies direct table and limiter-function access to anon and authenticated clients", async () => {
    const clients = [createAnonClient(), await createAuthenticatedAdminClient()];

    for (const client of clients) {
      const tableResult = await (client.from as unknown as (table: string) => {
        select: (columns: string) => PromiseLike<{ error: unknown }>;
      })("login_rate_limit_buckets").select("*");
      expect(tableResult.error).not.toBeNull();

      const functionResult = await (
        client.rpc.bind(client) as unknown as (
          name: string,
          params: Record<string, string>,
        ) => PromiseLike<{ error: unknown }>
      )("consume_login_rate_limit", {
        p_ip_digest: digests.ipA,
        p_email_digest: digests.emailA,
        p_now: windowStart,
      });
      expect(functionResult.error).not.toBeNull();
    }
  });

  it("deletes only the email bucket after successful login", async () => {
    const limiter = limiterRpc(createServiceRoleClient());

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expectAllowed(await limiter.consume(digests.ipA, digests.emailA), true);
    }

    const deletion = await limiter.deleteEmail(digests.emailA);
    expect(deletion.error).toBeNull();
    await expectAllowed(await limiter.consume(digests.ipB, digests.emailA), true);
    await expectAllowed(await limiter.consume(digests.ipA, digests.emailB), false);
  });

  it("idempotently cleans only buckets expired for more than forty-eight hours", async () => {
    const limiter = limiterRpc(createServiceRoleClient());
    await expectAllowed(await limiter.consume(digests.ipA, digests.emailA, windowStart), true);
    await expectAllowed(await limiter.consume(digests.ipB, digests.emailB, afterWindow), true);

    const first = await limiter.cleanup();
    const second = await limiter.cleanup();

    expect(first.error).toBeNull();
    expect(first.data).toEqual({ deleted_count: 4 });
    expect(second.error).toBeNull();
    expect(second.data).toEqual({ deleted_count: 0 });
  });

  it("stores digest-only limiter state without raw PII fields", async () => {
    const environment = readDisposableStackEnvironment();
    const response = await fetch(`${environment.url}/rest/v1/`, {
      headers: {
        apikey: environment.serviceRoleKey,
        Authorization: `Bearer ${environment.serviceRoleKey}`,
      },
    });
    const schema = (await response.json()) as {
      definitions?: Record<string, { properties?: Record<string, unknown> }>;
    };
    const fields = Object.keys(
      schema.definitions?.login_rate_limit_buckets?.properties ?? {},
    );

    expect(response.ok).toBe(true);
    expect(fields).toEqual(
      expect.arrayContaining(["bucket_type", "key_digest", "attempt_count", "window_started_at", "expires_at"]),
    );
    expect(fields).not.toEqual(
      expect.arrayContaining([
        "email",
        "password",
        "session",
        "ip",
        "client_ip",
        "forwarded_for",
        "forwarding_headers",
        "digest_secret",
      ]),
    );
  });
});
