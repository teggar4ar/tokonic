import "server-only";

import { z } from "zod";

export type ServerEnvironment = {
  VERCEL: "1";
  LOGIN_TRUSTED_PROXY_MODE: "vercel-direct";
  LOGIN_RATE_LIMIT_ATTEMPTS: "5";
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: "900";
  LOGIN_RATE_LIMIT_DIGEST_SECRET: string;
  SUPABASE_SECRET_KEY: string;
};

const serverEnvSchema = z.object({
  VERCEL: z.literal("1"),
  LOGIN_TRUSTED_PROXY_MODE: z.literal("vercel-direct"),
  LOGIN_RATE_LIMIT_ATTEMPTS: z.literal("5"),
  LOGIN_RATE_LIMIT_WINDOW_SECONDS: z.literal("900"),
  LOGIN_RATE_LIMIT_DIGEST_SECRET: z.string().min(32),
  SUPABASE_SECRET_KEY: z.string().min(20),
});

export function readServerEnv(): ServerEnvironment {
  return serverEnvSchema.parse({
    VERCEL: process.env.VERCEL,
    LOGIN_TRUSTED_PROXY_MODE: process.env.LOGIN_TRUSTED_PROXY_MODE,
    LOGIN_RATE_LIMIT_ATTEMPTS: process.env.LOGIN_RATE_LIMIT_ATTEMPTS,
    LOGIN_RATE_LIMIT_WINDOW_SECONDS: process.env.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    LOGIN_RATE_LIMIT_DIGEST_SECRET: process.env.LOGIN_RATE_LIMIT_DIGEST_SECRET,
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
  });
}
