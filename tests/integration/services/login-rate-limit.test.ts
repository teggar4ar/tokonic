import { createHmac } from "node:crypto";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readServerEnv } from "../../../src/lib/env/server";
import { createLoginRateLimitDataFromClient } from "../../../src/server/data/login-rate-limit";
import {
  canonicalizeTrustedClientIp,
  deriveLoginDigests,
  executeLoginBoundary,
  loginWithRateLimit,
  parseLoginRateLimitConfig,
  type LoginDependencies,
} from "../../../src/server/services/login-service";

const validConfig = {
  VERCEL: "1",
  LOGIN_TRUSTED_PROXY_MODE: "vercel-direct",
  LOGIN_RATE_LIMIT_ATTEMPTS: "5",
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: "900",
  LOGIN_RATE_LIMIT_DIGEST_SECRET: "a".repeat(64),
  SUPABASE_SECRET_KEY: "sb_secret_synthetic_test_key_1234567890",
};

const originalEnvironment = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnvironment };
});

const genericFailure = { ok: false, error: "invalid" } as const;
const success = { ok: true } as const;

function dependencies(overrides: Partial<LoginDependencies> = {}): LoginDependencies {
  return {
    consume: vi.fn().mockResolvedValue({ allowed: true, resetAt: "2026-07-24T00:15:00.000Z" }),
    authenticate: vi.fn().mockResolvedValue({ ok: true }),
    deleteEmailBucket: vi.fn().mockResolvedValue(undefined),
    rollbackSession: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

function request(overrides: Record<string, unknown> = {}) {
  return {
    email: "  Admin@Example.TEST  ",
    password: "synthetic-password",
    headers: { "x-forwarded-for": "203.0.113.7" },
    config: parseLoginRateLimitConfig(validConfig),
    ...overrides,
  };
}

describe("login rate-limit service contract", () => {
  it("requires the exact fixed deployment, limiter, secret, and Supabase configuration", () => {
    expect(parseLoginRateLimitConfig(validConfig)).toEqual({
      deployment: "vercel",
      proxyMode: "vercel-direct",
      attempts: 5,
      windowSeconds: 900,
      digestSecret: validConfig.LOGIN_RATE_LIMIT_DIGEST_SECRET,
    });

    for (const env of [
      { ...validConfig, VERCEL: "0" },
      { ...validConfig, LOGIN_TRUSTED_PROXY_MODE: "VERCEL-DIRECT" },
      { ...validConfig, LOGIN_TRUSTED_PROXY_MODE: "proxy" },
      { ...validConfig, LOGIN_RATE_LIMIT_ATTEMPTS: "6" },
      { ...validConfig, LOGIN_RATE_LIMIT_WINDOW_SECONDS: "899" },
      { ...validConfig, LOGIN_RATE_LIMIT_DIGEST_SECRET: "short" },
    ]) {
      expect(() => parseLoginRateLimitConfig(env)).toThrow();
    }
  });

  it("normalizes email and derives deterministic separate HMAC-SHA256 digests", () => {
    const result = deriveLoginDigests({
      email: "  Admin@Example.TEST  ",
      canonicalIp: "2001:db8::1",
      secret: validConfig.LOGIN_RATE_LIMIT_DIGEST_SECRET,
    });

    expect(result).toEqual({
      normalizedEmail: "admin@example.test",
      emailDigest: createHmac("sha256", validConfig.LOGIN_RATE_LIMIT_DIGEST_SECRET)
        .update("email:admin@example.test")
        .digest("hex"),
      ipDigest: createHmac("sha256", validConfig.LOGIN_RATE_LIMIT_DIGEST_SECRET)
        .update("ip:2001:db8::1")
        .digest("hex"),
    });
    expect(result.emailDigest).not.toBe(result.ipDigest);
    expect(JSON.stringify(result)).not.toContain("Admin@Example.TEST");
    expect(JSON.stringify(result)).not.toContain("2001:db8::1");
  });

  it.each([
    ["203.0.113.7", "203.0.113.7"],
    ["2001:db8:0:0:0:0:0:1", "2001:db8::1"],
    ["2001:0db8::1", "2001:db8::1"],
  ])("canonicalizes trusted IPv4 and IPv6 %s", (input, canonical) => {
    expect(canonicalizeTrustedClientIp(input)).toBe(canonical);
  });

  it.each(["", " 203.0.113.7", "203.0.113.7 ", "203.0.113.7, 198.51.100.2", "203.0.113.7,", "203.0.113.007", "999.1.1.1", "2001:db8::1%eth0", "not-an-ip"])(
    "rejects missing, chained, malformed, or noncanonical identity %j",
    (value) => {
      expect(() => canonicalizeTrustedClientIp(value)).toThrow();
    },
  );

  it("consumes both buckets before calling Auth and deletes only the email bucket on success", async () => {
    const calls: string[] = [];
    const deps = dependencies({
      consume: vi.fn(async () => {
        calls.push("consume");
        return { allowed: true, resetAt: "2026-07-24T00:15:00.000Z" };
      }),
      authenticate: vi.fn(async ({ email }) => {
        calls.push(`auth:${email}`);
        return { ok: true };
      }),
      deleteEmailBucket: vi.fn(async () => {
        calls.push("delete-email");
      }),
    });

    await expect(loginWithRateLimit(request(), deps)).resolves.toEqual(success);
    expect(calls).toEqual(["consume", "auth:admin@example.test", "delete-email"]);
    expect(deps.consume).toHaveBeenCalledWith(expect.objectContaining({ ipDigest: expect.any(String), emailDigest: expect.any(String) }));
    expect(deps.deleteEmailBucket).toHaveBeenCalledWith(expect.any(String));
  });

  it("does not call Auth when throttled or when limiter consumption fails", async () => {
    for (const consume of [
      vi.fn().mockResolvedValue({ allowed: false }),
      vi.fn().mockRejectedValue(new Error("synthetic dependency failure")),
    ]) {
      const deps = dependencies({ consume });
      await expect(loginWithRateLimit(request(), deps)).resolves.toEqual(genericFailure);
      expect(deps.authenticate).not.toHaveBeenCalled();
    }
  });

  it("does not delete any bucket after invalid credentials", async () => {
    const deps = dependencies({ authenticate: vi.fn().mockResolvedValue({ ok: false }) });

    await expect(loginWithRateLimit(request(), deps)).resolves.toEqual(genericFailure);
    expect(deps.deleteEmailBucket).not.toHaveBeenCalled();
    expect(deps.rollbackSession).not.toHaveBeenCalled();
  });

  it("rolls back the authenticated session and fails generically when email-bucket deletion fails", async () => {
    const deps = dependencies({
      deleteEmailBucket: vi.fn().mockRejectedValue(new Error("synthetic delete failure")),
    });

    await expect(loginWithRateLimit(request(), deps)).resolves.toEqual(genericFailure);
    expect(deps.rollbackSession).toHaveBeenCalledOnce();
  });

  it("fails closed without Auth for missing or untrusted client identity", async () => {
    for (const headers of [
      {},
      { "x-real-ip": "203.0.113.7" },
      { "x-forwarded-for": "203.0.113.7, 198.51.100.2" },
      { "x-forwarded-for": ["203.0.113.7", "198.51.100.2"] },
    ]) {
      const deps = dependencies();
      await expect(loginWithRateLimit(request({ headers }), deps)).resolves.toEqual(genericFailure);
      expect(deps.consume).not.toHaveBeenCalled();
      expect(deps.authenticate).not.toHaveBeenCalled();
    }
  });

  it("maps validation, configuration, identity, database, and credential failures identically", async () => {
    const cases = [
      [request({ email: "invalid" }), dependencies()],
      [request({ headers: {} }), dependencies()],
      [request(), dependencies({ consume: vi.fn().mockRejectedValue(new Error("db")) })],
      [request(), dependencies({ authenticate: vi.fn().mockResolvedValue({ ok: false }) })],
    ] as const;

    for (const [input, deps] of cases) {
      await expect(loginWithRateLimit(input, deps)).resolves.toEqual(genericFailure);
    }
  });

  it("reads the actual server environment boundary and restores process state", () => {
    Object.assign(process.env, validConfig);
    expect(readServerEnv()).toEqual(validConfig);

    delete process.env.VERCEL;
    expect(() => readServerEnv()).toThrow();
  });

  it("domain-separates identical email and IP source strings", () => {
    const result = deriveLoginDigests({
      email: "2001:db8::1",
      canonicalIp: "2001:db8::1",
      secret: validConfig.LOGIN_RATE_LIMIT_DIGEST_SECRET,
    });

    expect(result.emailDigest).not.toBe(result.ipDigest);
  });

  it.each([
    ["::ffff:192.0.2.128", "192.0.2.128"],
    ["0:0:0:0:0:ffff:c000:0280", "192.0.2.128"],
  ])("canonicalizes mapped IPv6 identity %s", (input, canonical) => {
    expect(canonicalizeTrustedClientIp(input)).toBe(canonical);
  });

  it("uses real Headers case-insensitively and deletes exactly the email digest", async () => {
    const deps = dependencies();
    const headers = new Headers();
    headers.set("X-Forwarded-For", "2001:0db8::1");
    const digests = deriveLoginDigests({
      email: "admin@example.test",
      canonicalIp: "2001:db8::1",
      secret: validConfig.LOGIN_RATE_LIMIT_DIGEST_SECRET,
    });

    await expect(loginWithRateLimit(request({ headers }), deps)).resolves.toEqual(success);
    expect(deps.consume).toHaveBeenCalledWith({ ipDigest: digests.ipDigest, emailDigest: digests.emailDigest });
    expect(deps.deleteEmailBucket).toHaveBeenCalledWith(digests.emailDigest);
    expect(digests.emailDigest).not.toBe(digests.ipDigest);
  });

  it("fails closed when real Headers coalesces repeated forwarded values", async () => {
    const deps = dependencies();
    const headers = new Headers();
    headers.append("x-forwarded-for", "203.0.113.7");
    headers.append("x-forwarded-for", "198.51.100.2");

    expect(headers.get("x-forwarded-for")).toContain(",");
    await expect(loginWithRateLimit(request({ headers }), deps)).resolves.toEqual(genericFailure);
    expect(deps.consume).not.toHaveBeenCalled();
    expect(deps.authenticate).not.toHaveBeenCalled();
  });

  it("returns generic failure when deletion and rollback both fail", async () => {
    const deps = dependencies({
      deleteEmailBucket: vi.fn().mockRejectedValue(new Error("delete")),
      rollbackSession: vi.fn().mockRejectedValue(new Error("rollback")),
    });

    await expect(loginWithRateLimit(request(), deps)).resolves.toEqual(genericFailure);
  });

  it("validates strict bounded RPC metadata and sends only digests to the adapter seam", async () => {
    const rpc = {
      consume: vi.fn().mockResolvedValue({
        data: { allowed: true, reset_at: "2026-07-24T00:15:00+00:00" },
        error: null,
      }),
      deleteEmailBucket: vi.fn().mockResolvedValue({ data: { deleted_count: 1 }, error: null }),
    };
    const adapter = createLoginRateLimitDataFromClient(rpc, () => new Date("2026-07-24T00:00:00.000Z"));

    await expect(adapter.consume({ ipDigest: "1".repeat(64), emailDigest: "2".repeat(64) })).resolves.toEqual({
      allowed: true,
      resetAt: "2026-07-24T00:15:00.000Z",
    });
    expect(rpc.consume).toHaveBeenCalledWith({
      ipDigest: "1".repeat(64),
      emailDigest: "2".repeat(64),
      now: "2026-07-24T00:00:00.000Z",
    });

    await adapter.deleteEmailBucket("2".repeat(64));
    expect(rpc.deleteEmailBucket).toHaveBeenCalledWith("2".repeat(64));
    expect(rpc.deleteEmailBucket).not.toHaveBeenCalledWith("1".repeat(64));

    rpc.consume.mockResolvedValueOnce({
      data: { allowed: false, reset_at: "2026-07-24T00:10:00+00:00" },
      error: null,
    });
    await expect(adapter.consume({ ipDigest: "1".repeat(64), emailDigest: "2".repeat(64) })).resolves.toEqual({
      allowed: false,
      resetAt: "2026-07-24T00:10:00.000Z",
    });

    for (const data of [
      { allowed: true, reset_at: "2026-07-24T00:15:00Z", extra: true },
      { allowed: true, reset_at: "not-a-date" },
      { allowed: true, reset_at: "2026-07-24T00:15:00.001Z" },
      { allowed: false, reset_at: "2026-07-23T23:59:59.000Z" },
    ]) {
      rpc.consume.mockResolvedValueOnce({ data, error: null });
      await expect(adapter.consume({ ipDigest: "1".repeat(64), emailDigest: "2".repeat(64) })).rejects.toThrow();
    }
  });

  it("maps boundary construction and runtime failures identically", async () => {
    const stages = ["environment", "config", "headers", "dependencies"] as const;

    for (const stage of stages) {
      const boundary = {
        readEnvironment: vi.fn(() => {
          if (stage === "environment") throw new Error("environment");
          return validConfig;
        }),
        getConfig: vi.fn((environment: typeof validConfig) => {
          if (stage === "config") throw new Error("config");
          return parseLoginRateLimitConfig(environment);
        }),
        getHeaders: vi.fn(async () => {
          if (stage === "headers") throw new Error("headers");
          return new Headers({ "x-forwarded-for": "203.0.113.7" });
        }),
        createDependencies: vi.fn(async () => {
          if (stage === "dependencies") throw new Error("dependencies");
          return dependencies();
        }),
      };

      await expect(executeLoginBoundary({ email: "admin@example.test", password: "secret" }, boundary)).resolves.toEqual(genericFailure);
    }
  });

  it("maps extracted boundary success without intercepting redirect control flow", async () => {
    const result = await executeLoginBoundary(
      { email: "admin@example.test", password: "secret" },
      {
        readEnvironment: () => validConfig,
        getConfig: parseLoginRateLimitConfig,
        getHeaders: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
        createDependencies: async () => dependencies(),
      },
    );

    expect(result).toEqual(success);
  });
});
