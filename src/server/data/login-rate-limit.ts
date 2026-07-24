import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database, Json } from "../../lib/supabase/database.types";

const consumeResultSchema = z.object({
  allowed: z.boolean(),
  reset_at: z.iso.datetime({ offset: true }),
}).strict();

const deleteResultSchema = z.object({
  deleted_count: z.number().int().min(0).max(1),
}).strict();

type LimiterRpcClient = {
  consume(input: { ipDigest: string; emailDigest: string; now: string }): Promise<{ data: Json; error: unknown }>;
  deleteEmailBucket(emailDigest: string): Promise<{ data: Json; error: unknown }>;
};

function createLimiterClient(supabaseUrl: string, secretKey: string): LimiterRpcClient {
  const client = createClient<Database>(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });

  return {
    async consume(input) {
      return client.rpc("consume_login_rate_limit", {
        p_ip_digest: input.ipDigest,
        p_email_digest: input.emailDigest,
        p_now: input.now,
      });
    },
    async deleteEmailBucket(emailDigest) {
      return client.rpc("delete_login_rate_limit_email_bucket", {
        p_email_digest: emailDigest,
      });
    },
  };
}

export function createLoginRateLimitDataFromClient(client: LimiterRpcClient, now = () => new Date()) {
  return {
    async consume(input: { ipDigest: string; emailDigest: string }) {
      const requestedAt = now();
      const { data, error } = await client.consume({
        ipDigest: input.ipDigest,
        emailDigest: input.emailDigest,
        now: requestedAt.toISOString(),
      });
      const parsed = consumeResultSchema.safeParse(data);

      if (error || !parsed.success) {
        throw new Error("Login rate limit unavailable");
      }

      const resetAt = new Date(parsed.data.reset_at);
      const maximumReset = new Date(requestedAt.getTime() + 900_000);

      if (resetAt < requestedAt || resetAt > maximumReset) {
        throw new Error("Login rate limit unavailable");
      }

      return { allowed: parsed.data.allowed, resetAt: resetAt.toISOString() };
    },
    async deleteEmailBucket(emailDigest: string) {
      const { data, error } = await client.deleteEmailBucket(emailDigest);
      const parsed = deleteResultSchema.safeParse(data);

      if (error || !parsed.success) {
        throw new Error("Login rate limit unavailable");
      }
    },
  };
}

export function createLoginRateLimitData(supabaseUrl: string, secretKey: string) {
  return createLoginRateLimitDataFromClient(createLimiterClient(supabaseUrl, secretKey));
}
