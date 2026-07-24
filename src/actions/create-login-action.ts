import "server-only";

import type { ServerEnvironment } from "../lib/env/server";
import {
  executeLoginBoundary,
  type LoginDependencies,
  type LoginRateLimitConfig,
} from "../server/services/login-service";

type AuthClient = {
  auth: {
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ error: unknown }>;
    signOut(): Promise<{ error: unknown }>;
  };
};

type LoginActionDependencies = {
  readEnvironment(): ServerEnvironment;
  getConfig(environment: ServerEnvironment): LoginRateLimitConfig;
  getHeaders(): Promise<Headers>;
  createAuthClient(): Promise<AuthClient>;
  createRateLimitData(supabaseUrl: string, secretKey: string): Pick<LoginDependencies, "consume" | "deleteEmailBucket">;
  getSupabaseUrl(): string | undefined;
  redirectTo(destination: string): never;
};

export function createLoginAction(dependencies: LoginActionDependencies) {
  return async function loginAction(formData: FormData) {
    const result = await executeLoginBoundary(
      {
        email: formData.get("email"),
        password: formData.get("password"),
      },
      {
        readEnvironment: dependencies.readEnvironment,
        getConfig: dependencies.getConfig,
        getHeaders: dependencies.getHeaders,
        async createDependencies(environment) {
          const supabase = await dependencies.createAuthClient();
          const supabaseUrl = dependencies.getSupabaseUrl();
          if (!supabaseUrl) {
            throw new Error("Supabase configuration unavailable");
          }
          const rateLimitData = dependencies.createRateLimitData(supabaseUrl, environment.SUPABASE_SECRET_KEY);

          return {
            ...rateLimitData,
            async authenticate(credentials) {
              const { error } = await supabase.auth.signInWithPassword(credentials);
              return { ok: !error };
            },
            async rollbackSession() {
              const { error } = await supabase.auth.signOut();
              if (error) {
                throw new Error("Session rollback failed");
              }
            },
          };
        },
      },
    );

    dependencies.redirectTo(result.ok ? "/admin" : "/admin/login?error=invalid");
  };
}
