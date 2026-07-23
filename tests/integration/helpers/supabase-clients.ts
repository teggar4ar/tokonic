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

export const SELLER_SEED_AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
export const SELLER_SEED_STORE_SLUG = "tokonic-development";
