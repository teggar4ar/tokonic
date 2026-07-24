import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/database.types";

import {
  createAnonClient,
  createAuthenticatedAdminClient,
  createServiceRoleClient,
  createUnrelatedAuthenticatedClient,
  readDisposableStackEnvironment,
  readProvisionedAdmin,
} from "../helpers/supabase-clients";

// ---------------------------------------------------------------------------
// Products and product_images are not in generated Database types until
// TASK-014. These helpers bypass TypeScript table-name checking while
// preserving full runtime behavior through the Supabase PostgREST client.
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type UntypedClient = SupabaseClient<any>;

function products(client: SupabaseClient<Database>) {
  return (client as UntypedClient).from("products");
}

function productImages(client: SupabaseClient<Database>) {
  return (client as UntypedClient).from("product_images");
}

// ---------------------------------------------------------------------------
// Direct database query helper — runs as the postgres superuser through the
// Supabase CLI, bypassing both RLS and PostgREST. Used only for schema
// introspection and privilege matrix assertions.
// ---------------------------------------------------------------------------
function queryDisposableDatabase<T>(query: string): T[] {
  readDisposableStackEnvironment();

  const databaseUrl = process.env.DB_URL;
  if (!databaseUrl) throw new Error('Missing required Supabase env var "DB_URL".');
  const hostname = new URL(databaseUrl).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
    throw new Error("Integration tests require a loopback PostgreSQL URL.");
  }
  const cli = resolve(
    "node_modules",
    ".bin",
    process.platform === "win32" ? "supabase.cmd" : "supabase",
  );
  const output = execFileSync(
    cli,
    ["db", "query", "--db-url", databaseUrl, "--output-format", "json", query],
    { encoding: "utf8", windowsHide: true },
  );
  return JSON.parse(output) as T[];
}

// ---------------------------------------------------------------------------
// Shared test state — initialised once per suite run in beforeAll.
// ---------------------------------------------------------------------------
let anonClient: SupabaseClient<Database>;
let ownerClient: SupabaseClient<Database>;
let unrelatedClient: SupabaseClient<Database>;
let serviceRoleClient: SupabaseClient<Database>;
let ownerSellerId: string;
let publishedProductId: string;
let unpublishedProductId: string;

beforeAll(async () => {
  serviceRoleClient = createServiceRoleClient();
  anonClient = createAnonClient();
  ownerClient = await createAuthenticatedAdminClient();
  unrelatedClient = await createUnrelatedAuthenticatedClient();

  // Obtain the provisioned seller row
  const admin = readProvisionedAdmin();
  const { data: sellerData } = await serviceRoleClient
    .from("sellers")
    .select("id")
    .eq("store_slug", admin.storeSlug)
    .single();
  if (!sellerData) throw new Error("Provisioned seller row not found");
  ownerSellerId = sellerData.id;

  // --- Seed two products: one published, one draft ---
  const { data: pubProduct, error: pubError } = await products(serviceRoleClient)
    .insert({
      seller_id: ownerSellerId,
      slug: "test-published-product",
      name: "Test Published Product",
      description: "A published test product",
      price: 50000,
      stock: 10,
      weight_grams: 500,
      is_published: true,
    })
    .select("id")
    .single();
  if (pubError || !pubProduct) {
    throw new Error(`Failed to create published product: ${pubError?.message}`);
  }
  publishedProductId = pubProduct.id;

  const { data: draftProduct, error: draftError } = await products(serviceRoleClient)
    .insert({
      seller_id: ownerSellerId,
      slug: "test-draft-product",
      name: "Test Draft Product",
      description: "",
      price: 75000,
      stock: 5,
      weight_grams: 300,
      is_published: false,
    })
    .select("id")
    .single();
  if (draftError || !draftProduct) {
    throw new Error(`Failed to create draft product: ${draftError?.message}`);
  }
  unpublishedProductId = draftProduct.id;

  // --- Seed one image per product ---
  const { error: pubImgError } = await productImages(serviceRoleClient)
    .insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/img-pub-1.jpg`,
      mime_type: "image/jpeg",
      byte_size: 102400,
      width: 800,
      height: 600,
      display_order: 0,
    });
  if (pubImgError) {
    throw new Error(`Failed to create published image: ${pubImgError.message}`);
  }

  const { error: draftImgError } = await productImages(serviceRoleClient)
    .insert({
      product_id: unpublishedProductId,
      bucket: "product-images",
      object_path: `products/${unpublishedProductId}/img-draft-1.jpg`,
      mime_type: "image/jpeg",
      byte_size: 51200,
      width: 400,
      height: 300,
      display_order: 0,
    });
  if (draftImgError) {
    throw new Error(`Failed to create draft image: ${draftImgError.message}`);
  }
});

// =========================================================================
// 1. CHECK CONSTRAINTS
// =========================================================================
describe("product schema — check constraints", () => {
  it("rejects negative price", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "neg-price",
      name: "Bad Price",
      price: -1,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("accepts zero price", async () => {
    const { data, error } = await products(serviceRoleClient)
      .insert({
        seller_id: ownerSellerId,
        slug: "zero-price",
        name: "Free Product",
        price: 0,
        stock: 0,
        weight_grams: 100,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Clean up
    await products(serviceRoleClient).delete().eq("id", data!.id);
  });

  it("rejects negative stock", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "neg-stock",
      name: "Bad Stock",
      price: 1000,
      stock: -1,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("rejects zero weight_grams", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "zero-weight",
      name: "No Weight",
      price: 1000,
      stock: 0,
      weight_grams: 0,
    });

    expect(error).not.toBeNull();
  });

  it("rejects negative weight_grams", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "neg-weight",
      name: "Negative Weight",
      price: 1000,
      stock: 0,
      weight_grams: -100,
    });

    expect(error).not.toBeNull();
  });

  it("rejects empty name after trim", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "empty-name",
      name: "   ",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("rejects invalid slug format (uppercase)", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "Invalid-Slug",
      name: "Invalid Slug",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("rejects invalid slug format (spaces)", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "has spaces",
      name: "Invalid Slug Spaces",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("rejects display_order outside 0–4", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/bad-order.jpg`,
      mime_type: "image/jpeg",
      byte_size: 1024,
      display_order: 5,
    });

    expect(error).not.toBeNull();
  });

  it("rejects negative display_order", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/neg-order.jpg`,
      mime_type: "image/jpeg",
      byte_size: 1024,
      display_order: -1,
    });

    expect(error).not.toBeNull();
  });

  it("rejects byte_size over 2 MB", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/too-big.jpg`,
      mime_type: "image/jpeg",
      byte_size: 2097153,
      display_order: 1,
    });

    expect(error).not.toBeNull();
  });

  it("rejects zero byte_size", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/zero-size.jpg`,
      mime_type: "image/jpeg",
      byte_size: 0,
      display_order: 1,
    });

    expect(error).not.toBeNull();
  });

  it("rejects SVG mime_type", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/bad-mime.svg`,
      mime_type: "image/svg+xml",
      byte_size: 1024,
      display_order: 1,
    });

    expect(error).not.toBeNull();
  });

  it("rejects zero width", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/zero-width.jpg`,
      mime_type: "image/jpeg",
      byte_size: 1024,
      width: 0,
      height: 600,
      display_order: 1,
    });

    expect(error).not.toBeNull();
  });

  it("rejects negative height", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/neg-height.jpg`,
      mime_type: "image/jpeg",
      byte_size: 1024,
      width: 800,
      height: -1,
      display_order: 1,
    });

    expect(error).not.toBeNull();
  });

  it("accepts null width and height", async () => {
    const { data, error } = await productImages(serviceRoleClient)
      .insert({
        product_id: publishedProductId,
        bucket: "product-images",
        object_path: `products/${publishedProductId}/no-dims.jpg`,
        mime_type: "image/jpeg",
        byte_size: 1024,
        display_order: 1,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Clean up
    await productImages(serviceRoleClient).delete().eq("id", data!.id);
  });
});

// =========================================================================
// 2. UNIQUE CONSTRAINTS
// =========================================================================
describe("product schema — unique constraints", () => {
  it("rejects duplicate (seller_id, slug)", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: ownerSellerId,
      slug: "test-published-product", // already exists from beforeAll
      name: "Duplicate Slug",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("rejects duplicate (product_id, display_order)", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/dup-order.jpg`,
      mime_type: "image/jpeg",
      byte_size: 1024,
      display_order: 0, // already taken from beforeAll
    });

    expect(error).not.toBeNull();
  });

  it("rejects duplicate object_path", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/img-pub-1.jpg`, // already exists
      mime_type: "image/jpeg",
      byte_size: 1024,
      display_order: 2,
    });

    expect(error).not.toBeNull();
  });
});

// =========================================================================
// 3. FOREIGN KEYS AND CASCADES
// =========================================================================
describe("product schema — foreign keys and cascades", () => {
  it("rejects product with non-existent seller_id", async () => {
    const { error } = await products(serviceRoleClient).insert({
      seller_id: "00000000-0000-0000-0000-000000000099",
      slug: "orphan-product",
      name: "Orphan Product",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("rejects image with non-existent product_id", async () => {
    const { error } = await productImages(serviceRoleClient).insert({
      product_id: "00000000-0000-0000-0000-000000000099",
      bucket: "product-images",
      object_path: "products/orphan/img.jpg",
      mime_type: "image/jpeg",
      byte_size: 1024,
      display_order: 0,
    });

    expect(error).not.toBeNull();
  });

  it("cascade-deletes images when product is deleted", async () => {
    // Create a temporary product via SQL (bypasses all restrictions)
    const tempProducts = queryDisposableDatabase<{ id: string }>(
      `insert into public.products (seller_id, slug, name, price, stock, weight_grams)
       values ('${ownerSellerId}', 'cascade-test', 'Cascade Test', 1000, 0, 100)
       returning id`,
    );
    const tempId = tempProducts[0].id;

    // Insert an image for it
    queryDisposableDatabase(
      `insert into public.product_images (product_id, bucket, object_path, mime_type, byte_size, display_order)
       values ('${tempId}', 'product-images', 'products/${tempId}/cascade.jpg', 'image/jpeg', 1024, 0)`,
    );

    // Verify image exists
    const beforeDelete = queryDisposableDatabase<{ count: string }>(
      `select count(*)::text as count from public.product_images where product_id = '${tempId}'`,
    );
    expect(parseInt(beforeDelete[0].count)).toBe(1);

    // Delete the product
    queryDisposableDatabase(`delete from public.products where id = '${tempId}'`);

    // Verify images were cascade-deleted
    const afterDelete = queryDisposableDatabase<{ count: string }>(
      `select count(*)::text as count from public.product_images where product_id = '${tempId}'`,
    );
    expect(parseInt(afterDelete[0].count)).toBe(0);
  });

  it("restricts seller deletion when products reference it", async () => {
    // Attempting to delete the seller should fail because products reference it
    const result = queryDisposableDatabase<{ success: boolean }>(
      `do $$ begin
         delete from public.sellers where id = '${ownerSellerId}';
         raise exception 'Should not reach here';
       exception when foreign_key_violation then
         -- Expected
       end $$;
       select true as success`,
    );
    expect(result).toBeDefined();
  });
});

// =========================================================================
// 4. DEFAULTS AND TRIGGERS
// =========================================================================
describe("product schema — defaults and triggers", () => {
  it("defaults is_published to false", async () => {
    const { data, error } = await products(serviceRoleClient)
      .insert({
        seller_id: ownerSellerId,
        slug: "default-test",
        name: "Default Test",
        price: 1000,
        stock: 0,
        weight_grams: 100,
      })
      .select("is_published")
      .single();

    expect(error).toBeNull();
    expect(data?.is_published).toBe(false);

    // Clean up
    await products(serviceRoleClient).delete().eq("slug", "default-test");
  });

  it("defaults description to empty string", async () => {
    const { data, error } = await products(serviceRoleClient)
      .insert({
        seller_id: ownerSellerId,
        slug: "desc-default-test",
        name: "Description Default",
        price: 1000,
        stock: 0,
        weight_grams: 100,
      })
      .select("description")
      .single();

    expect(error).toBeNull();
    expect(data?.description).toBe("");

    // Clean up
    await products(serviceRoleClient).delete().eq("slug", "desc-default-test");
  });

  it("auto-generates UUID id", async () => {
    const { data, error } = await products(serviceRoleClient)
      .insert({
        seller_id: ownerSellerId,
        slug: "uuid-test",
        name: "UUID Test",
        price: 1000,
        stock: 0,
        weight_grams: 100,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data?.id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );

    // Clean up
    await products(serviceRoleClient).delete().eq("id", data!.id);
  });

  it("sets created_at and updated_at automatically", async () => {
    const before = new Date().toISOString();
    const { data, error } = await products(serviceRoleClient)
      .insert({
        seller_id: ownerSellerId,
        slug: "timestamp-test",
        name: "Timestamp Test",
        price: 1000,
        stock: 0,
        weight_grams: 100,
      })
      .select("created_at, updated_at")
      .single();

    expect(error).toBeNull();
    expect(new Date(data!.created_at).getTime()).toBeGreaterThanOrEqual(
      new Date(before).getTime() - 1000,
    );
    expect(data!.updated_at).toBe(data!.created_at);

    // Clean up
    await products(serviceRoleClient).delete().eq("slug", "timestamp-test");
  });

  it("updates updated_at on product mutation", async () => {
    const { data: original } = await products(serviceRoleClient)
      .select("updated_at")
      .eq("id", publishedProductId)
      .single();
    const originalTimestamp = original!.updated_at;

    // Small delay to ensure timestamp changes
    await new Promise((r) => setTimeout(r, 50));

    await products(serviceRoleClient)
      .update({ name: "Updated Name" })
      .eq("id", publishedProductId);

    const { data: updated } = await products(serviceRoleClient)
      .select("updated_at")
      .eq("id", publishedProductId)
      .single();

    expect(new Date(updated!.updated_at).getTime()).toBeGreaterThan(
      new Date(originalTimestamp).getTime(),
    );

    // Restore original name
    await products(serviceRoleClient)
      .update({ name: "Test Published Product" })
      .eq("id", publishedProductId);
  });

  it("prevents updating immutable product fields (id)", async () => {
    const { error } = await products(serviceRoleClient)
      .update({ id: "00000000-0000-0000-0000-000000000099" })
      .eq("id", publishedProductId);

    expect(error).not.toBeNull();
  });

  it("prevents updating immutable product fields (seller_id)", async () => {
    const { error } = await products(serviceRoleClient)
      .update({ seller_id: "00000000-0000-0000-0000-000000000099" })
      .eq("id", publishedProductId);

    expect(error).not.toBeNull();
  });

  it("prevents updating immutable product fields (created_at)", async () => {
    const { error } = await products(serviceRoleClient)
      .update({ created_at: "2020-01-01T00:00:00Z" })
      .eq("id", publishedProductId);

    expect(error).not.toBeNull();
  });
});

// =========================================================================
// 5. RLS — ANON ACCESS
// =========================================================================
describe("product RLS — anon access", () => {
  it("can read published products", async () => {
    const { data, error } = await products(anonClient)
      .select("id, name, is_published")
      .eq("id", publishedProductId);

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].is_published).toBe(true);
  });

  it("cannot read unpublished products", async () => {
    const { data, error } = await products(anonClient)
      .select("id")
      .eq("id", unpublishedProductId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("can read images of published products", async () => {
    const { data, error } = await productImages(anonClient)
      .select("id, product_id")
      .eq("product_id", publishedProductId);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("cannot read images of unpublished products", async () => {
    const { data, error } = await productImages(anonClient)
      .select("id")
      .eq("product_id", unpublishedProductId);

    expect(error).toBeNull();
    expect(data).toHaveLength(0);
  });

  it("cannot insert a product", async () => {
    const { error } = await products(anonClient).insert({
      seller_id: ownerSellerId,
      slug: "anon-product",
      name: "Anon Product",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("cannot update any product", async () => {
    const { data, error } = await products(anonClient)
      .update({ name: "Hacked" })
      .eq("id", publishedProductId)
      .select("id");

    const blocked = error !== null || (Array.isArray(data) && data.length === 0);
    expect(blocked).toBe(true);
  });

  it("cannot delete any product", async () => {
    const { error } = await products(anonClient)
      .delete()
      .eq("id", publishedProductId);

    expect(error).not.toBeNull();
  });

  it("cannot insert a product image", async () => {
    const { error } = await productImages(anonClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/anon.jpg`,
      mime_type: "image/jpeg",
      byte_size: 1024,
      display_order: 3,
    });

    expect(error).not.toBeNull();
  });

  it("cannot delete a product image", async () => {
    const { error } = await productImages(anonClient)
      .delete()
      .eq("product_id", publishedProductId);

    expect(error).not.toBeNull();
  });
});

// =========================================================================
// 6. RLS — OWNER ACCESS
// =========================================================================
describe("product RLS — owner access", () => {
  it("can read all own products (published and unpublished)", async () => {
    const { data, error } = await products(ownerClient).select("id");

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(2);

    const ids = data!.map((r: { id: string }) => r.id);
    expect(ids).toContain(publishedProductId);
    expect(ids).toContain(unpublishedProductId);
  });

  it("can insert a product for own seller_id", async () => {
    const { data, error } = await products(ownerClient)
      .insert({
        seller_id: ownerSellerId,
        slug: "owner-insert-test",
        name: "Owner Insert Test",
        price: 2000,
        stock: 1,
        weight_grams: 200,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Clean up via service_role (owner might not have DELETE depending on policy)
    await products(serviceRoleClient).delete().eq("id", data!.id);
  });

  it("cannot insert a product for a different seller_id", async () => {
    const { error } = await products(ownerClient).insert({
      seller_id: "00000000-0000-0000-0000-000000000099",
      slug: "stolen-product",
      name: "Stolen Product",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("can update own product mutable fields", async () => {
    const { data, error } = await products(ownerClient)
      .update({ name: "Owner Updated Name", price: 99000 })
      .eq("id", publishedProductId)
      .select("name, price")
      .single();

    expect(error).toBeNull();
    expect(data?.name).toBe("Owner Updated Name");
    expect(data?.price).toBe(99000);

    // Restore
    await products(serviceRoleClient)
      .update({ name: "Test Published Product", price: 50000 })
      .eq("id", publishedProductId);
  });

  it("can delete own product", async () => {
    // Create a temporary product to delete
    const { data: temp } = await products(ownerClient)
      .insert({
        seller_id: ownerSellerId,
        slug: "delete-me",
        name: "Delete Me",
        price: 1000,
        stock: 0,
        weight_grams: 100,
      })
      .select("id")
      .single();
    expect(temp).not.toBeNull();

    const { error } = await products(ownerClient)
      .delete()
      .eq("id", temp!.id);

    expect(error).toBeNull();
  });

  it("can read own product images", async () => {
    const { data, error } = await productImages(ownerClient)
      .select("id, product_id")
      .eq("product_id", publishedProductId);

    expect(error).toBeNull();
    expect(data!.length).toBeGreaterThanOrEqual(1);
  });

  it("can insert own product images", async () => {
    const { data, error } = await productImages(ownerClient)
      .insert({
        product_id: publishedProductId,
        bucket: "product-images",
        object_path: `products/${publishedProductId}/owner-img.jpg`,
        mime_type: "image/png",
        byte_size: 204800,
        width: 1024,
        height: 768,
        display_order: 2,
      })
      .select("id")
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();

    // Clean up
    await productImages(serviceRoleClient).delete().eq("id", data!.id);
  });

  it("can update own product image display_order", async () => {
    // Get the existing image for the published product
    const { data: imgs } = await productImages(ownerClient)
      .select("id, display_order")
      .eq("product_id", publishedProductId);
    expect(imgs!.length).toBeGreaterThanOrEqual(1);
    const imgId = imgs![0].id;

    const { data, error } = await productImages(ownerClient)
      .update({ display_order: 3 })
      .eq("id", imgId)
      .select("display_order")
      .single();

    expect(error).toBeNull();
    expect(data?.display_order).toBe(3);

    // Restore
    await productImages(serviceRoleClient)
      .update({ display_order: 0 })
      .eq("id", imgId);
  });

  it("can delete own product images", async () => {
    // Create a temporary image to delete
    const { data: temp } = await productImages(ownerClient)
      .insert({
        product_id: publishedProductId,
        bucket: "product-images",
        object_path: `products/${publishedProductId}/delete-me.jpg`,
        mime_type: "image/webp",
        byte_size: 1024,
        display_order: 4,
      })
      .select("id")
      .single();
    expect(temp).not.toBeNull();

    const { error } = await productImages(ownerClient)
      .delete()
      .eq("id", temp!.id);

    expect(error).toBeNull();
  });
});

// =========================================================================
// 7. RLS — UNRELATED AUTHENTICATED USER ISOLATION
// =========================================================================
describe("product RLS — unrelated authenticated user isolation", () => {
  it("reads zero products (authenticated policy is ownership-only)", async () => {
    const { data, error } = await products(unrelatedClient).select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("reads zero product images", async () => {
    const { data, error } = await productImages(unrelatedClient).select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot insert a product", async () => {
    const { error } = await products(unrelatedClient).insert({
      seller_id: ownerSellerId,
      slug: "intruder-product",
      name: "Intruder Product",
      price: 1000,
      stock: 0,
      weight_grams: 100,
    });

    expect(error).not.toBeNull();
  });

  it("cannot update any product", async () => {
    const { data, error } = await products(unrelatedClient)
      .update({ name: "Hijacked" })
      .eq("id", publishedProductId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot delete any product", async () => {
    const { data, error } = await products(unrelatedClient)
      .delete()
      .eq("id", publishedProductId)
      .select("id");

    // PostgREST may return empty instead of error for row-filtered deletes
    const blocked = error !== null || (Array.isArray(data) && data.length === 0);
    expect(blocked).toBe(true);
  });

  it("cannot insert a product image", async () => {
    const { error } = await productImages(unrelatedClient).insert({
      product_id: publishedProductId,
      bucket: "product-images",
      object_path: `products/${publishedProductId}/intruder.jpg`,
      mime_type: "image/jpeg",
      byte_size: 1024,
      display_order: 3,
    });

    expect(error).not.toBeNull();
  });

  it("cannot update any product image", async () => {
    const { data, error } = await productImages(unrelatedClient)
      .update({ display_order: 4 })
      .eq("product_id", publishedProductId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot delete any product image", async () => {
    const { data, error } = await productImages(unrelatedClient)
      .delete()
      .eq("product_id", publishedProductId)
      .select("id");

    const blocked = error !== null || (Array.isArray(data) && data.length === 0);
    expect(blocked).toBe(true);
  });
});

// =========================================================================
// 8. PRIVILEGE MATRICES
// =========================================================================
function queryTablePrivileges(tableName: string) {
  return queryDisposableDatabase<{
    role_name: string;
    has_select: boolean;
    has_insert: boolean;
    has_update: boolean;
    has_delete: boolean;
  }>(
    `with roles(role_name, role_oid) as (
       values
         ('anon', pg_catalog.to_regrole('anon')::oid),
         ('authenticated', pg_catalog.to_regrole('authenticated')::oid),
         ('service_role', pg_catalog.to_regrole('service_role')::oid)
     )
     select
       role_name,
       pg_catalog.has_table_privilege(role_oid, 'public.${tableName}', 'SELECT') as has_select,
       pg_catalog.has_table_privilege(role_oid, 'public.${tableName}', 'INSERT') as has_insert,
       pg_catalog.has_table_privilege(role_oid, 'public.${tableName}', 'UPDATE') as has_update,
       pg_catalog.has_table_privilege(role_oid, 'public.${tableName}', 'DELETE') as has_delete
     from roles
     order by role_name`,
  );
}

function queryRlsEnabled(tableName: string) {
  return queryDisposableDatabase<{ rowsecurity: boolean }>(
    `select relrowsecurity as rowsecurity
     from pg_catalog.pg_class
     where relname = '${tableName}'
       and relnamespace = 'public'::regnamespace`,
  );
}

function queryTablePolicies(tableName: string) {
  return queryDisposableDatabase<{
    policyname: string;
    cmd: string;
    qual: string;
    with_check: string | null;
  }>(
    `select
       polname as policyname,
       case polcmd
         when 'r' then 'r' when 'w' then 'w' when 'a' then 'a'
         when 'd' then 'd' when '*' then '*'
       end as cmd,
       pg_catalog.pg_get_expr(polqual, polrelid) as qual,
       pg_catalog.pg_get_expr(polwithcheck, polrelid) as with_check
     from pg_catalog.pg_policy
     where polrelid = 'public.${tableName}'::regclass
     order by polname`,
  );
}

describe("products privilege matrix", () => {
  it("anon has SELECT only", () => {
    const privileges = queryTablePrivileges("products");
    const anon = privileges.find(({ role_name }) => role_name === "anon");

    expect(anon).toBeDefined();
    expect(anon!.has_select).toBe(true);
    expect(anon!.has_insert).toBe(false);
    expect(anon!.has_update).toBe(false);
    expect(anon!.has_delete).toBe(false);
  });

  it("authenticated has SELECT, INSERT, UPDATE, DELETE", () => {
    const privileges = queryTablePrivileges("products");
    const auth = privileges.find(({ role_name }) => role_name === "authenticated");

    expect(auth).toBeDefined();
    expect(auth!.has_select).toBe(true);
    expect(auth!.has_insert).toBe(true);
    expect(auth!.has_update).toBe(true);
    expect(auth!.has_delete).toBe(true);
  });

  it("service_role has SELECT, INSERT, UPDATE, DELETE", () => {
    const privileges = queryTablePrivileges("products");
    const sr = privileges.find(({ role_name }) => role_name === "service_role");

    expect(sr).toBeDefined();
    expect(sr!.has_select).toBe(true);
    expect(sr!.has_insert).toBe(true);
    expect(sr!.has_update).toBe(true);
    expect(sr!.has_delete).toBe(true);
  });

  it("RLS is enabled", () => {
    const result = queryRlsEnabled("products");
    expect(result).toHaveLength(1);
    expect(result[0].rowsecurity).toBe(true);
  });

  it("policies enforce ownership predicates via auth.uid()", () => {
    const policies = queryTablePolicies("products");

    // Expect policies for anon SELECT, and authenticated SELECT/INSERT/UPDATE/DELETE
    expect(policies.length).toBeGreaterThanOrEqual(2);

    // All authenticated policies should reference auth.uid()
    const authPolicies = policies.filter(
      (p) => p.qual?.includes("auth.uid()") || p.with_check?.includes("auth.uid()"),
    );
    expect(authPolicies.length).toBeGreaterThanOrEqual(1);

    // Anon published-only policy should reference is_published
    const anonPolicy = policies.find((p) => p.qual?.includes("is_published"));
    expect(anonPolicy).toBeDefined();
  });
});

describe("product_images privilege matrix", () => {
  it("anon has SELECT only", () => {
    const privileges = queryTablePrivileges("product_images");
    const anon = privileges.find(({ role_name }) => role_name === "anon");

    expect(anon).toBeDefined();
    expect(anon!.has_select).toBe(true);
    expect(anon!.has_insert).toBe(false);
    expect(anon!.has_update).toBe(false);
    expect(anon!.has_delete).toBe(false);
  });

  it("authenticated has SELECT, INSERT, UPDATE, DELETE", () => {
    const privileges = queryTablePrivileges("product_images");
    const auth = privileges.find(({ role_name }) => role_name === "authenticated");

    expect(auth).toBeDefined();
    expect(auth!.has_select).toBe(true);
    expect(auth!.has_insert).toBe(true);
    expect(auth!.has_update).toBe(true);
    expect(auth!.has_delete).toBe(true);
  });

  it("service_role has SELECT, INSERT, UPDATE, DELETE", () => {
    const privileges = queryTablePrivileges("product_images");
    const sr = privileges.find(({ role_name }) => role_name === "service_role");

    expect(sr).toBeDefined();
    expect(sr!.has_select).toBe(true);
    expect(sr!.has_insert).toBe(true);
    expect(sr!.has_update).toBe(true);
    expect(sr!.has_delete).toBe(true);
  });

  it("RLS is enabled", () => {
    const result = queryRlsEnabled("product_images");
    expect(result).toHaveLength(1);
    expect(result[0].rowsecurity).toBe(true);
  });

  it("policies enforce ownership via product → seller → auth.uid()", () => {
    const policies = queryTablePolicies("product_images");

    expect(policies.length).toBeGreaterThanOrEqual(2);

    // Authenticated policies should reference auth.uid() through the join
    const authPolicies = policies.filter(
      (p) => p.qual?.includes("auth.uid()") || p.with_check?.includes("auth.uid()"),
    );
    expect(authPolicies.length).toBeGreaterThanOrEqual(1);

    // Anon policy should reference is_published through products
    const anonPolicy = policies.find((p) => p.qual?.includes("is_published"));
    expect(anonPolicy).toBeDefined();
  });
});

// =========================================================================
// 9. COLUMN-LEVEL UPDATE GRANTS (products)
// =========================================================================
describe("products column-level update grants", () => {
  function queryColumnUpdatePrivilege(role: string, column: string): boolean {
    const result = queryDisposableDatabase<{ has_privilege: boolean }>(
      `select pg_catalog.has_column_privilege(
         pg_catalog.to_regrole('${role}')::oid,
         'public.products',
         '${column}',
         'UPDATE'
       ) as has_privilege`,
    );
    return result[0]?.has_privilege ?? false;
  }

  it("authenticated can update mutable fields", () => {
    expect(queryColumnUpdatePrivilege("authenticated", "name")).toBe(true);
    expect(queryColumnUpdatePrivilege("authenticated", "slug")).toBe(true);
    expect(queryColumnUpdatePrivilege("authenticated", "description")).toBe(true);
    expect(queryColumnUpdatePrivilege("authenticated", "price")).toBe(true);
    expect(queryColumnUpdatePrivilege("authenticated", "stock")).toBe(true);
    expect(queryColumnUpdatePrivilege("authenticated", "weight_grams")).toBe(true);
    expect(queryColumnUpdatePrivilege("authenticated", "is_published")).toBe(true);
  });

  it("authenticated cannot update immutable fields", () => {
    expect(queryColumnUpdatePrivilege("authenticated", "id")).toBe(false);
    expect(queryColumnUpdatePrivilege("authenticated", "seller_id")).toBe(false);
    expect(queryColumnUpdatePrivilege("authenticated", "created_at")).toBe(false);
    expect(queryColumnUpdatePrivilege("authenticated", "updated_at")).toBe(false);
  });
});
