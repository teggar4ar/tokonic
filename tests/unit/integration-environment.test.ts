import { afterEach, describe, expect, it, vi } from "vitest";

import { readDisposableStackEnvironment } from "../../tests/integration/helpers/supabase-clients";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
  vi.unstubAllEnvs();
});

describe("readDisposableStackEnvironment", () => {
  it("accepts the GitHub Actions disposable loopback stack", () => {
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("API_URL", "http://127.0.0.1:54321");
    vi.stubEnv("ANON_KEY", "anon-test-key");
    vi.stubEnv("SERVICE_ROLE_KEY", "service-role-test-key");

    expect(readDisposableStackEnvironment()).toEqual({
      url: "http://127.0.0.1:54321",
      anonKey: "anon-test-key",
      serviceRoleKey: "service-role-test-key",
    });
  });

  it("rejects execution outside GitHub Actions", () => {
    vi.stubEnv("GITHUB_ACTIONS", "false");
    vi.stubEnv("API_URL", "http://127.0.0.1:54321");
    vi.stubEnv("ANON_KEY", "anon-test-key");
    vi.stubEnv("SERVICE_ROLE_KEY", "service-role-test-key");

    expect(() => readDisposableStackEnvironment()).toThrow("GitHub Actions");
  });

  it("rejects a non-loopback Supabase target", () => {
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("API_URL", "https://shared-project.supabase.co");
    vi.stubEnv("ANON_KEY", "anon-test-key");
    vi.stubEnv("SERVICE_ROLE_KEY", "service-role-test-key");

    expect(() => readDisposableStackEnvironment()).toThrow("loopback");
  });

  it("does not fall back to shared Supabase environment variables", () => {
    vi.stubEnv("GITHUB_ACTIONS", "true");
    vi.stubEnv("SUPABASE_URL", "http://127.0.0.1:54321");
    vi.stubEnv("SUPABASE_ANON_KEY", "anon-test-key");
    vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-test-key");
    delete process.env.API_URL;
    delete process.env.ANON_KEY;
    delete process.env.SERVICE_ROLE_KEY;

    expect(() => readDisposableStackEnvironment()).toThrow("API_URL");
  });
});
