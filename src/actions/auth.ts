"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createLoginAction } from "./create-login-action";
import { publicEnv } from "../lib/env/public";
import { readServerEnv } from "../lib/env/server";
import { createClient } from "../lib/supabase/server";
import { createLoginRateLimitData } from "../server/data/login-rate-limit";
import { parseLoginRateLimitConfig } from "../server/services/login-service";

export const login = createLoginAction({
  readEnvironment: readServerEnv,
  getConfig: parseLoginRateLimitConfig,
  getHeaders: headers,
  createAuthClient: createClient,
  createRateLimitData: createLoginRateLimitData,
  getSupabaseUrl: () => publicEnv.NEXT_PUBLIC_SUPABASE_URL,
  redirectTo: redirect,
});

export async function logout() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  if (data.user) {
    const { error } = await supabase.auth.signOut();

    if (error) {
      redirect("/admin?error=logout");
    }
  }

  redirect("/admin/login");
}
