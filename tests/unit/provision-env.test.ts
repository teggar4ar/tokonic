import { describe, expect, it } from "vitest";

import { parseProvisionEnv } from "../../scripts/lib/provision-env";

function validEnv(overrides: Record<string, string | undefined> = {}) {
  return {
    GITHUB_ACTIONS: "true",
    API_URL: "http://127.0.0.1:54321",
    SERVICE_ROLE_KEY: "test-service-role-key",
    CI_ADMIN_EMAIL: "admin@example.test",
    CI_ADMIN_PASSWORD: "test-password-ci",
    CI_ADMIN_STORE_NAME: "CI Test Store",
    CI_ADMIN_STORE_SLUG: "ci-test-store",
    CI_ADMIN_WHATSAPP_PHONE: "6280000000000",
    CI_ADMIN_ORIGIN_LABEL: "TEST ORIGIN",
    CI_ADMIN_ORIGIN_ADDRESS: "Alamat pengujian nonproduksi",
    CI_ADMIN_ORIGIN_RAJAONGKIR_ID: "8583",
    CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL: "subdistrict",
    ...overrides,
  };
}

describe("parseProvisionEnv", () => {
  it("parses a valid CI environment", () => {
    const result = parseProvisionEnv(validEnv());

    expect(result.CI_ADMIN_EMAIL).toBe("admin@example.test");
    expect(result.CI_ADMIN_STORE_SLUG).toBe("ci-test-store");
    expect(result.CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL).toBe("subdistrict");
  });

  it("rejects execution outside GitHub Actions", () => {
    expect(() => parseProvisionEnv(validEnv({ GITHUB_ACTIONS: undefined }))).toThrow(
      "GitHub Actions",
    );
  });

  it("rejects GITHUB_ACTIONS values other than 'true'", () => {
    expect(() => parseProvisionEnv(validEnv({ GITHUB_ACTIONS: "false" }))).toThrow(
      "GitHub Actions",
    );
  });

  it("rejects a non-loopback Supabase URL", () => {
    expect(() =>
      parseProvisionEnv(validEnv({ API_URL: "https://abc.supabase.co" })),
    ).toThrow("loopback");
  });

  it("rejects a remote Supabase URL", () => {
    expect(() =>
      parseProvisionEnv(
        validEnv({ API_URL: "https://my-project.supabase.co" }),
      ),
    ).toThrow("loopback");
  });

  it("accepts localhost URL", () => {
    const result = parseProvisionEnv(
      validEnv({ API_URL: "http://localhost:54321" }),
    );
    expect(result.API_URL).toBe("http://localhost:54321");
  });

  it("rejects missing required fields", () => {
    expect(() =>
      parseProvisionEnv(validEnv({ CI_ADMIN_EMAIL: undefined })),
    ).toThrow();
  });

  it("rejects an invalid email", () => {
    expect(() =>
      parseProvisionEnv(validEnv({ CI_ADMIN_EMAIL: "not-an-email" })),
    ).toThrow();
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(() =>
      parseProvisionEnv(validEnv({ CI_ADMIN_PASSWORD: "short" })),
    ).toThrow();
  });

  it("rejects an invalid store slug", () => {
    expect(() =>
      parseProvisionEnv(validEnv({ CI_ADMIN_STORE_SLUG: "Has Spaces" })),
    ).toThrow();
  });

  it("rejects an invalid WhatsApp phone", () => {
    expect(() =>
      parseProvisionEnv(validEnv({ CI_ADMIN_WHATSAPP_PHONE: "0800" })),
    ).toThrow();
  });

  it("rejects an invalid RajaOngkir level", () => {
    expect(() =>
      parseProvisionEnv(
        validEnv({ CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL: "province" }),
      ),
    ).toThrow();
  });

  it("does not include GITHUB_ACTIONS or unknown fields in the result", () => {
    const result = parseProvisionEnv(validEnv());

    expect(result).not.toHaveProperty("GITHUB_ACTIONS");
    expect(Object.keys(result)).toHaveLength(11);
  });
});
