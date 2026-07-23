import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/database.types";

function requiredEnv(primary: string, fallback?: string): string {
  const value = process.env[primary] ?? (fallback ? process.env[fallback] : undefined);
  if (!value) {
    throw new Error(
      `Missing required Supabase env var "${primary}"${
        fallback ? ` (or fallback "${fallback}")` : ""
      }. Start the disposable stack and export \`supabase status -o env\` before running integration tests.`,
    );
  }
  return value;
}

function stackUrl(): string {
  return requiredEnv("API_URL", "SUPABASE_URL");
}

function anonKey(): string {
  return requiredEnv("ANON_KEY", "SUPABASE_ANON_KEY");
}

function serviceRoleKey(): string {
  return requiredEnv("SERVICE_ROLE_KEY", "SUPABASE_SERVICE_ROLE_KEY");
}

function buildClient(key: string): SupabaseClient<Database> {
  return createClient<Database>(stackUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function createAnonClient(): SupabaseClient<Database> {
  return buildClient(anonKey());
}

export function createServiceRoleClient(): SupabaseClient<Database> {
  return buildClient(serviceRoleKey());
}

export const SELLER_SEED_AUTH_USER_ID = "11111111-1111-4111-8111-111111111111";
export const SELLER_SEED_STORE_SLUG = "tokonic-development";
