import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve("supabase/migrations/20260726080400_move_image_lifecycle_to_private_schema.sql"),
  "utf8",
).toLowerCase();

const functions = [
  "register_product_image(uuid, text, text, text, integer, integer, integer, smallint)",
  "replace_product_image(uuid, text, text, integer, integer, integer)",
  "begin_product_deletion(uuid)",
  "finalize_product_deletion(uuid, text[])",
];

describe("private image lifecycle forward migration", () => {
  it.each(functions)("moves %s into the private schema", (signature) => {
    expect(sql).toContain(`alter function public.${signature}\nset schema private`);
  });

  it("exposes only SECURITY INVOKER wrappers", () => {
    const wrappers = [...sql.matchAll(/create function public\.(?:register_product_image|replace_product_image|begin_product_deletion|finalize_product_deletion)[\s\S]*?\$\$;/g)].map((match) => match[0]);

    expect(wrappers).toHaveLength(4);
    for (const wrapper of wrappers) {
      expect(wrapper).toContain("security invoker");
      expect(wrapper).not.toContain("security definer");
      expect(wrapper).toContain("private.");
      expect(wrapper).toContain("set search_path = ''");
    }
  });

  it.each(functions)("restricts public and private %s execution to authenticated", (signature) => {
    expect(sql).toContain(`revoke all on function private.${signature} from public, anon`);
    expect(sql).toContain(`grant execute on function private.${signature} to authenticated`);
    expect(sql).toContain(`revoke all on function public.${signature} from public, anon`);
    expect(sql).toContain(`grant execute on function public.${signature} to authenticated`);
  });

  it("grants private schema usage and indexes deletion receipt ownership", () => {
    expect(sql).toContain("grant usage on schema private to authenticated");
    expect(sql).toContain("create index product_deletion_receipts_seller_id_idx");
    expect(sql).toContain("on public.product_deletion_receipts (seller_id)");
  });
});
