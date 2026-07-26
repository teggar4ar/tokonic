import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/database.types";
import { storageImageFixtures } from "../../fixtures/storage-images";
import {
  createAnonClient,
  createAuthenticatedAdminClient,
  createServiceRoleClient,
  createUnrelatedAuthenticatedClient,
  readProvisionedAdmin,
} from "../helpers/supabase-clients";

const bucket = "product-images";
type RpcResult = { data: unknown; error: { message: string } | null };
type LifecycleClient = SupabaseClient<Database> & {
  rpc(name: "register_product_image", args: Record<string, unknown>): PromiseLike<RpcResult>;
  rpc(name: "replace_product_image", args: Record<string, unknown>): PromiseLike<RpcResult>;
  rpc(name: "delete_product_image", args: Record<string, unknown>): PromiseLike<RpcResult>;
  rpc(name: "begin_product_deletion", args: Record<string, unknown>): PromiseLike<RpcResult>;
  rpc(name: "finalize_product_deletion", args: Record<string, unknown>): PromiseLike<RpcResult>;
};

let owner: LifecycleClient;
let concurrentOwner: LifecycleClient;
let anon: LifecycleClient;
let unrelated: LifecycleClient;
let serviceRole: SupabaseClient<Database>;
let sellerId: string;

function imagePath(productId: string, imageId = crypto.randomUUID()) {
  return `products/${productId}/${imageId}.jpg`;
}

async function createProduct(label: string) {
  const id = crypto.randomUUID();
  const { error } = await serviceRole.from("products").insert({
    id,
    seller_id: sellerId,
    slug: `lifecycle-${id}`,
    name: label,
    price: 1_000,
    stock: 1,
    weight_grams: 100,
  });
  if (error) throw error;
  return id;
}

async function upload(path: string) {
  const result = await owner.storage.from(bucket).upload(path, storageImageFixtures.jpeg.bytes, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (result.error) throw result.error;
}

function register(client: LifecycleClient, productId: string, path: string, displayOrder: number) {
  return client.rpc("register_product_image", {
    p_product_id: productId,
    p_bucket: bucket,
    p_object_path: path,
    p_mime_type: "image/jpeg",
    p_byte_size: storageImageFixtures.jpeg.bytes.byteLength,
    p_width: 1,
    p_height: 1,
    p_display_order: displayOrder,
  });
}

function beginDelete(client: LifecycleClient, productId: string) {
  return client.rpc("begin_product_deletion", { p_product_id: productId });
}

function finalizeDelete(client: LifecycleClient, productId: string, cleanedPaths: string[]) {
  return client.rpc("finalize_product_deletion", {
    p_product_id: productId,
    p_cleaned_object_paths: cleanedPaths,
  });
}

beforeAll(async () => {
  serviceRole = createServiceRoleClient();
  owner = await createAuthenticatedAdminClient() as LifecycleClient;
  concurrentOwner = await createAuthenticatedAdminClient() as LifecycleClient;
  anon = createAnonClient() as LifecycleClient;
  unrelated = await createUnrelatedAuthenticatedClient() as LifecycleClient;
  const admin = readProvisionedAdmin();
  const { data, error } = await serviceRole.from("sellers").select("id").eq("store_slug", admin.storeSlug).single();
  if (error || !data) throw new Error("Provisioned seller was not found");
  sellerId = data.id;
});

describe("transactional product image lifecycle", () => {
  it("atomically permits at most five genuinely concurrent different-slot registrations", async () => {
    const productId = await createProduct("Concurrent image limit");
    const candidates = await Promise.all(Array.from({ length: 6 }, async (_, displayOrder) => {
      const path = imagePath(productId);
      await upload(path);
      return { path, displayOrder };
    }));

    const results = await Promise.all(candidates.map(({ path, displayOrder }) => register(owner, productId, path, displayOrder)));
    const accepted = results.filter((result) => !result.error);
    const { count } = await serviceRole.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);

    expect(accepted).toHaveLength(5);
    expect(count).toBe(5);
  });

  it("serializes registration and deletion so registration wins with its path included or deletion wins and rejects registration", async () => {
    const productId = await createProduct("Registration deletion race");
    const path = imagePath(productId);
    await upload(path);

    const [registration, deletion] = await Promise.all([
      register(owner, productId, path, 0),
      beginDelete(concurrentOwner, productId),
    ]);

    expect(Number(!registration.error) + Number(!deletion.error)).toBeGreaterThanOrEqual(1);
    if (!registration.error) {
      expect(deletion.error).toBeNull();
      expect(JSON.stringify(deletion.data)).toContain(path);
    } else {
      expect(deletion.error).toBeNull();
      expect(registration.error.message).toMatch(/delet|state|conflict/i);
      expect((await owner.storage.from(bucket).remove([path])).error).toBeNull();
    }
  }, 60_000);

  it("makes begin, retry, and finalize deletion idempotent", async () => {
    const productId = await createProduct("Idempotent deletion");
    const path = imagePath(productId);
    await upload(path);
    expect((await register(owner, productId, path, 0)).error).toBeNull();

    const first = await beginDelete(owner, productId);
    const retry = await beginDelete(owner, productId);
    expect(first.error).toBeNull();
    expect(retry.error).toBeNull();
    expect(retry.data).toEqual(first.data);

    expect((await owner.storage.from(bucket).remove([path])).error).toBeNull();
    expect((await finalizeDelete(owner, productId, [path])).error).toBeNull();
    expect((await finalizeDelete(owner, productId, [path])).error).toBeNull();
    expect((await serviceRole.from("products").select("id").eq("id", productId)).data).toHaveLength(0);
  });

  it("refuses finalization after a partial Storage deletion outcome", async () => {
    const productId = await createProduct("Partial deletion");
    const paths = [imagePath(productId), imagePath(productId)];
    await Promise.all(paths.map(upload));
    expect((await register(owner, productId, paths[0], 0)).error).toBeNull();
    expect((await register(owner, productId, paths[1], 1)).error).toBeNull();
    expect((await beginDelete(owner, productId)).error).toBeNull();

    expect((await owner.storage.from(bucket).remove([paths[0]])).error).toBeNull();
    const partial = await finalizeDelete(owner, productId, [paths[0]]);

    expect(partial.error).not.toBeNull();
    expect((await serviceRole.from("products").select("id").eq("id", productId)).data).toHaveLength(1);
  });

  it.each([
    ["anon", () => anon],
    ["unrelated authenticated user", () => unrelated],
  ])("does not allow %s to invoke lifecycle functions", async (_role, client) => {
    const productId = await createProduct("Function grants");
    const path = imagePath(productId);

    expect((await register(client(), productId, path, 0)).error).not.toBeNull();
    expect((await beginDelete(client(), productId)).error).not.toBeNull();
    expect((await finalizeDelete(client(), productId, [])).error).not.toBeNull();
  });

  it("routes metadata deletion through the narrowly granted owner-authorized lifecycle RPC", async () => {
    const productId = await createProduct("Lifecycle image deletion");
    const path = imagePath(productId);
    await upload(path);
    const registration = await register(owner, productId, path, 0);
    expect(registration.error).toBeNull();
    const imageId = (registration.data as { id: string }).id;

    expect((await unrelated.rpc("delete_product_image", { p_image_id: imageId })).error).not.toBeNull();
    expect((await owner.rpc("delete_product_image", { p_image_id: imageId })).error).toBeNull();
    expect((await serviceRole.from("product_images").select("id").eq("id", imageId)).data).toHaveLength(0);
  });

  it("enforces owner authorization inside every lifecycle function", async () => {
    const productId = await createProduct("Owner authorization");
    const path = imagePath(productId);

    expect((await register(unrelated, productId, path, 0)).error).not.toBeNull();
    expect((await beginDelete(unrelated, productId)).error).not.toBeNull();
    expect((await finalizeDelete(unrelated, productId, [])).error).not.toBeNull();
    expect((await serviceRole.from("products").select("id").eq("id", productId)).data).toHaveLength(1);
  });
});
