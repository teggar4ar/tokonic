import { describe, expect, it } from "vitest";

import { createServiceRoleClient, SELLER_SEED_AUTH_USER_ID, SELLER_SEED_STORE_SLUG } from "../helpers/supabase-clients";

describe("disposable CI Supabase stack", () => {
  it("replays migrations from empty and seeds the synthetic seller", async () => {
    const admin = createServiceRoleClient();

    const { data, error } = await admin
      .from("sellers")
      .select("auth_user_id, store_slug")
      .eq("auth_user_id", SELLER_SEED_AUTH_USER_ID)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.store_slug).toBe(SELLER_SEED_STORE_SLUG);
  });
});
