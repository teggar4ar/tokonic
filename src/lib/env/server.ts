import "server-only";

import { z } from "zod";

export type ServerEnvironment = {
  NODE_ENV: "development" | "test" | "production";
  VERCEL?: "1";
  LOGIN_RATE_LIMIT_TRUSTED_PROXY_MODE: "vercel-direct" | "localhost-development";
  LOGIN_RATE_LIMIT_ATTEMPTS: "5";
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: "900";
  LOGIN_RATE_LIMIT_DIGEST_SECRET: string;
  SUPABASE_SECRET_KEY: string;
};

const serverEnvSchema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]),
    VERCEL: z.literal("1").optional(),
    LOGIN_RATE_LIMIT_TRUSTED_PROXY_MODE: z.enum(["vercel-direct", "localhost-development"]),
    LOGIN_RATE_LIMIT_ATTEMPTS: z.literal("5"),
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.literal("900"),
    LOGIN_RATE_LIMIT_DIGEST_SECRET: z.string().min(32),
    SUPABASE_SECRET_KEY: z.string().min(20),
  })
  .superRefine((environment, context) => {
    const validVercel = environment.LOGIN_RATE_LIMIT_TRUSTED_PROXY_MODE === "vercel-direct" && environment.VERCEL === "1";
    const validLocalhost =
      environment.LOGIN_RATE_LIMIT_TRUSTED_PROXY_MODE === "localhost-development" &&
      environment.NODE_ENV !== "production" &&
      environment.VERCEL === undefined;

    if (!validVercel && !validLocalhost) {
      context.addIssue({ code: "custom", message: "Invalid login deployment configuration" });
    }
  });

export function readServerEnv(): ServerEnvironment {
  return serverEnvSchema.parse({
    NODE_ENV: process.env.NODE_ENV,
    VERCEL: process.env.VERCEL,
    LOGIN_RATE_LIMIT_TRUSTED_PROXY_MODE: process.env.LOGIN_RATE_LIMIT_TRUSTED_PROXY_MODE,
    LOGIN_RATE_LIMIT_ATTEMPTS: process.env.LOGIN_RATE_LIMIT_ATTEMPTS,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    LOGIN_RATE_LIMIT_DIGEST_SECRET: process.env.LOGIN_RATE_LIMIT_DIGEST_SECRET,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}
