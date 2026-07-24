import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/database.types";

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required Supabase env var "${name}".`);
  }
  return value;
}

export function readDisposableStackEnvironment() {
  if (process.env.GITHUB_ACTIONS !== "true") {
    throw new Error("Integration tests may run only in GitHub Actions.");
  }

  const url = requiredEnv("API_URL");
  const hostname = new URL(url).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
    throw new Error("Integration tests require a loopback Supabase URL.");
  }

  return {
    url,
    anonKey: requiredEnv("ANON_KEY"),
    serviceRoleKey: requiredEnv("SERVICE_ROLE_KEY"),
  };
}

function buildClient(key: string, url: string): SupabaseClient<Database> {
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient(): SupabaseClient<Database> {
  const environment = readDisposableStackEnvironment();
  return buildClient(environment.anonKey, environment.url);
}

export function createServiceRoleClient(): SupabaseClient<Database> {
  const environment = readDisposableStackEnvironment();
  return buildClient(environment.serviceRoleKey, environment.url);
}

export function readProvisionedAdmin() {
  return {
    email: requiredEnv("CI_ADMIN_EMAIL"),
    password: requiredEnv("CI_ADMIN_PASSWORD"),
    storeSlug: requiredEnv("CI_ADMIN_STORE_SLUG"),
  };
}

export async function createAuthenticatedAdminClient(): Promise<SupabaseClient<Database>> {
  const env = readDisposableStackEnvironment();
  const admin = readProvisionedAdmin();
  const client = buildClient(env.anonKey, env.url);
  const { error } = await client.auth.signInWithPassword({
    email: admin.email,
    password: admin.password,
  });
  if (error) {
    throw new Error(`Failed to sign in as provisioned admin: ${error.message}`);
  }
  return client;
}
