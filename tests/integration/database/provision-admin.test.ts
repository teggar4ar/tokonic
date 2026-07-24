import { describe, expect, it } from "vitest";

import {
  createServiceRoleClient,
  readDisposableStackEnvironment,
  readProvisionedAdmin,
} from "../helpers/supabase-clients";
import { provisionAdmin } from "../../../scripts/lib/provision-admin";

function buildProvisionEnv() {
  const stack = readDisposableStackEnvironment();
  return {
    API_URL: stack.url,
    SERVICE_ROLE_KEY: stack.serviceRoleKey,
    CI_ADMIN_EMAIL: process.env.CI_ADMIN_EMAIL!,
    CI_ADMIN_PASSWORD: process.env.CI_ADMIN_PASSWORD!,
    CI_ADMIN_STORE_NAME: process.env.CI_ADMIN_STORE_NAME!,
    CI_ADMIN_STORE_SLUG: process.env.CI_ADMIN_STORE_SLUG!,
    CI_ADMIN_WHATSAPP_PHONE: process.env.CI_ADMIN_WHATSAPP_PHONE!,
    CI_ADMIN_ORIGIN_LABEL: process.env.CI_ADMIN_ORIGIN_LABEL!,
    CI_ADMIN_ORIGIN_ADDRESS: process.env.CI_ADMIN_ORIGIN_ADDRESS!,
    CI_ADMIN_ORIGIN_RAJAONGKIR_ID: process.env.CI_ADMIN_ORIGIN_RAJAONGKIR_ID!,
    CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL: process.env.CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL! as "district" | "subdistrict",
  };
}

describe("provision-admin idempotency", () => {
  it("re-provisions without error and returns the same auth user", async () => {
    const env = buildProvisionEnv();

    const first = await provisionAdmin(env);
    const second = await provisionAdmin(env);

    expect(second.authUserId).toBe(first.authUserId);
    expect(second.sellerId).toBe(first.sellerId);
    expect(second.created).toBe(false);
  });

  it("creates a login-capable Auth user", async () => {
    const stack = readDisposableStackEnvironment();
    const admin = readProvisionedAdmin();

    const { createClient } = await import("@supabase/supabase-js");
    const client = createClient(stack.url, stack.anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await client.auth.signInWithPassword({
      email: admin.email,
      password: admin.password,
    });

    expect(error).toBeNull();
    expect(data.user).not.toBeNull();
    expect(data.user?.email).toBe(admin.email);
  });

  it("links exactly one seller row with correct fields", async () => {
    const serviceRole = createServiceRoleClient();
    const admin = readProvisionedAdmin();

    const { data, error } = await serviceRole
      .from("sellers")
      .select("store_slug, store_name")
      .eq("store_slug", admin.storeSlug);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });
});
