import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  redirect: vi.fn((destination: string): never => {
    throw new Error(`redirect:${destination}`);
  }),
  readServerEnv: vi.fn(),
  createClient: vi.fn(),
  createRateLimitData: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));
vi.mock("../../../src/lib/env/public", () => ({
  publicEnv: {
    NEXT_PUBLIC_SUPABASE_URL: "https://example.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_synthetic_test_key",
  },
}));
vi.mock("../../../src/lib/env/server", async () => {
  const actual = await vi.importActual<typeof import("../../../src/lib/env/server")>("../../../src/lib/env/server");
  return { ...actual, readServerEnv: mocks.readServerEnv };
});
vi.mock("../../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));
vi.mock("../../../src/server/data/login-rate-limit", async () => {
  const actual = await vi.importActual<typeof import("../../../src/server/data/login-rate-limit")>(
    "../../../src/server/data/login-rate-limit",
  );
  return { ...actual, createLoginRateLimitData: mocks.createRateLimitData };
});

import { login } from "../../../src/actions/auth";
import { createLoginAction } from "../../../src/actions/create-login-action";
import { parseLoginRateLimitConfig } from "../../../src/server/services/login-service";

const environment = {
  VERCEL: "1" as const,
  LOGIN_TRUSTED_PROXY_MODE: "vercel-direct" as const,
  LOGIN_RATE_LIMIT_ATTEMPTS: "5" as const,
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: "900" as const,
  LOGIN_RATE_LIMIT_DIGEST_SECRET: "a".repeat(64),
  SUPABASE_SECRET_KEY: "sb_secret_synthetic_test_key_1234567890",
};

function formData() {
  const data = new FormData();
  data.set("email", "admin@example.test");
  data.set("password", "synthetic-password");
  return data;
}

function authClient(overrides: { authError?: unknown; rollbackError?: unknown } = {}) {
  return {
    auth: {
      signInWithPassword: vi.fn().mockResolvedValue({ error: overrides.authError ?? null }),
      signOut: vi.fn().mockResolvedValue({ error: overrides.rollbackError ?? null }),
    },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.readServerEnv.mockReturnValue(environment);
  mocks.headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7" }));
  mocks.createClient.mockResolvedValue(authClient());
  mocks.createRateLimitData.mockReturnValue({
    consume: vi.fn().mockResolvedValue({ allowed: true, resetAt: "2026-07-24T00:15:00.000Z" }),
    deleteEmailBucket: vi.fn().mockResolvedValue(undefined),
  });
});

describe("login action wiring", () => {
  it("uses the real exported login dependencies and redirects successful login to admin", async () => {
    await expect(login(formData())).rejects.toThrow("redirect:/admin");

    expect(mocks.headers).toHaveBeenCalledOnce();
    expect(mocks.createClient).toHaveBeenCalledOnce();
    expect(mocks.createRateLimitData).toHaveBeenCalledWith(
      "https://example.supabase.co",
      environment.SUPABASE_SECRET_KEY,
    );
    expect(mocks.redirect).toHaveBeenCalledWith("/admin");
  });

  it.each(["environment", "headers", "client", "adapter", "auth"] as const)(
    "maps %s failure through the actual login export to the generic redirect",
    async (stage) => {
      if (stage === "environment") mocks.readServerEnv.mockImplementation(() => { throw new Error("environment"); });
      if (stage === "headers") mocks.headers.mockRejectedValue(new Error("headers"));
      if (stage === "client") mocks.createClient.mockRejectedValue(new Error("client"));
      if (stage === "adapter") mocks.createRateLimitData.mockImplementation(() => { throw new Error("adapter"); });
      if (stage === "auth") mocks.createClient.mockResolvedValue(authClient({ authError: new Error("credential") }));

      await expect(login(formData())).rejects.toThrow("redirect:/admin/login?error=invalid");
      expect(mocks.redirect).toHaveBeenCalledWith("/admin/login?error=invalid");
    },
  );

  it("maps rollback errors through the actual login export to the generic redirect", async () => {
    mocks.createClient.mockResolvedValue(authClient({ rollbackError: new Error("rollback") }));
    mocks.createRateLimitData.mockReturnValue({
      consume: vi.fn().mockResolvedValue({ allowed: true, resetAt: "2026-07-24T00:15:00.000Z" }),
      deleteEmailBucket: vi.fn().mockRejectedValue(new Error("delete")),
    });

    await expect(login(formData())).rejects.toThrow("redirect:/admin/login?error=invalid");
    expect(mocks.redirect).toHaveBeenCalledWith("/admin/login?error=invalid");
  });

  it("keeps redirect execution outside the generic boundary catch", async () => {
    const redirectTo = vi.fn((destination: string): never => {
      throw new Error(`control:${destination}`);
    });
    const action = createLoginAction({
      readEnvironment: () => environment,
      getConfig: parseLoginRateLimitConfig,
      getHeaders: async () => new Headers({ "x-forwarded-for": "203.0.113.7" }),
      createAuthClient: async () => authClient(),
      createRateLimitData: () => ({
        consume: vi.fn().mockResolvedValue({ allowed: true, resetAt: "2026-07-24T00:15:00.000Z" }),
        deleteEmailBucket: vi.fn().mockResolvedValue(undefined),
      }),
      getSupabaseUrl: () => "https://example.supabase.co",
      redirectTo,
    });

    await expect(action(formData())).rejects.toThrow("control:/admin");
    expect(redirectTo).toHaveBeenCalledOnce();
  });
});
