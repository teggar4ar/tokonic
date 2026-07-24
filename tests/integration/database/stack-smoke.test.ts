import { describe, expect, it } from "vitest";

import {
  createServiceRoleClient,
  readProvisionedAdmin,
} from "../helpers/supabase-clients";

describe("disposable CI Supabase stack", () => {
  it("replays migrations and provisions the CI admin with a linked seller", async () => {
    const serviceRole = createServiceRoleClient();
    const admin = readProvisionedAdmin();

    const { data, error } = await serviceRole
      .from("sellers")
      .select("store_slug")
      .eq("store_slug", admin.storeSlug)
      .maybeSingle();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data?.store_slug).toBe(admin.storeSlug);
  });
});
