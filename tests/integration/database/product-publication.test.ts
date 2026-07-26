import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/database.types";
import {
  createAnonClient,
  createAuthenticatedAdminClient,
  createServiceRoleClient,
  createUnrelatedAuthenticatedClient,
  readProvisionedAdmin,
} from "../helpers/supabase-clients";

type RpcResult = { data: unknown; error: { code?: string; message: string } | null };
type PublicationClient = SupabaseClient<Database> & {
  rpc(
    name: "set_product_publication",
    args: { p_product_id: string; p_is_published: boolean },
  ): PromiseLike<RpcResult>;
  rpc(name: "begin_product_deletion", args: { p_product_id: string }): PromiseLike<RpcResult>;
};

let owner: PublicationClient;
let anon: PublicationClient;
let unrelated: PublicationClient;
let serviceRole: SupabaseClient<Database>;
let sellerId: string;

async function createProduct(isPublished: boolean) {
  const id = crypto.randomUUID();
  const { error } = await serviceRole.from("products").insert({
    id,
    seller_id: sellerId,
    slug: `publication-${id}`,
    name: "Publication test product",
    price: 1_000,
    stock: 1,
    weight_grams: 100,
    is_published: isPublished,
  });
  if (error) throw error;
  return id;
}

async function readPublication(productId: string) {
  const { data, error } = await serviceRole
    .from("products")
    .select("is_published")
    .eq("id", productId)
    .single();
  if (error || !data) throw error ?? new Error("Product not found");
  return data.is_published;
}

beforeAll(async () => {
  serviceRole = createServiceRoleClient();
  owner = (await createAuthenticatedAdminClient()) as PublicationClient;
  anon = createAnonClient() as PublicationClient;
  unrelated = (await createUnrelatedAuthenticatedClient()) as PublicationClient;
  const admin = readProvisionedAdmin();
  const { data, error } = await serviceRole
    .from("sellers")
    .select("id")
    .eq("store_slug", admin.storeSlug)
    .single();
  if (error || !data) throw new Error("Provisioned seller was not found");
  sellerId = data.id;
});

describe("product publication state mutation", () => {
  it("still denies direct is_published updates for the owner", async () => {
    const productId = await createProduct(false);

    const { error } = await owner
      .from("products")
      .update({ is_published: true })
      .eq("id", productId);

    expect(error).not.toBeNull();
    expect(await readPublication(productId)).toBe(false);
  });

  it("owner can publish and unpublish through the RPC", async () => {
    const productId = await createProduct(false);

    const publish = await owner.rpc("set_product_publication", {
      p_product_id: productId,
      p_is_published: true,
    });

    expect(publish.error).toBeNull();
    expect(await readPublication(productId)).toBe(true);

    const unpublish = await owner.rpc("set_product_publication", {
      p_product_id: productId,
      p_is_published: false,
    });

    expect(unpublish.error).toBeNull();
    expect(await readPublication(productId)).toBe(false);
  });

  it("returns the full owned product state from the RPC", async () => {
    const productId = await createProduct(false);

    const { data, error } = await owner.rpc("set_product_publication", {
      p_product_id: productId,
      p_is_published: true,
    });

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: productId,
      seller_id: sellerId,
      name: "Publication test product",
      price: 1_000,
      stock: 1,
      weight_grams: 100,
      is_published: true,
    });
  });

  it("unrelated authenticated user cannot change publication state", async () => {
    const productId = await createProduct(false);

    const { error } = await unrelated.rpc("set_product_publication", {
      p_product_id: productId,
      p_is_published: true,
    });

    expect(error).not.toBeNull();
    expect(await readPublication(productId)).toBe(false);
  });

  it("anon cannot execute the publication RPC", async () => {
    const productId = await createProduct(false);

    const { error } = await anon.rpc("set_product_publication", {
      p_product_id: productId,
      p_is_published: true,
    });

    expect(error).not.toBeNull();
    expect(await readPublication(productId)).toBe(false);
  });

  it("rejects publication while product deletion is in progress", async () => {
    const productId = await createProduct(true);

    const begin = await owner.rpc("begin_product_deletion", { p_product_id: productId });
    expect(begin.error).toBeNull();

    const { error } = await owner.rpc("set_product_publication", {
      p_product_id: productId,
      p_is_published: true,
    });

    expect(error).not.toBeNull();
    expect(await readPublication(productId)).toBe(false);
  }, 60_000);
});
