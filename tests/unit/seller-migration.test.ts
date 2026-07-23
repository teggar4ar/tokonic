import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  resolve("supabase/migrations/20260722072721_create_sellers.sql"),
  "utf8",
);
const hardeningMigration = readFileSync(
  resolve("supabase/migrations/20260722094729_harden_sellers_integrity.sql"),
  "utf8",
);

describe("seller database security contract", () => {
  it("enables RLS and scopes access to the authenticated owner", () => {
    expect(migration).toContain("alter table public.sellers enable row level security");
    expect(migration).toContain("using ((select auth.uid()) = auth_user_id)");
    expect(migration).toContain("with check ((select auth.uid()) = auth_user_id)");
  });

  it("does not grant anonymous access or authenticated provisioning", () => {
    expect(migration).toContain("revoke all on table public.sellers from anon, authenticated");
    expect(migration).not.toMatch(/grant\s+(?:select,\s*)?insert/i);
    expect(migration).not.toMatch(/grant\s+.*delete/i);
  });

  it("protects immutable fields and maintains updated_at", () => {
    expect(hardeningMigration).toContain("Seller identity and creation fields are immutable");
    expect(hardeningMigration).toContain("new.updated_at = now()");
    expect(hardeningMigration).toContain("grant update (");
  });
});
