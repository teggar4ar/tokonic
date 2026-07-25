import { beforeAll, describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/database.types";
import {
  createOversizedImageFixture,
  storageImageFixtures,
} from "../../fixtures/storage-images";
import {
  createAnonClient,
  createAuthenticatedAdminClient,
  createServiceRoleClient,
  createUnrelatedAuthenticatedClient,
  readProvisionedAdmin,
} from "../helpers/supabase-clients";

const bucketName = "product-images";
const validObjectId = "10000000-0000-4000-8000-000000000001";
const duplicateObjectId = "10000000-0000-4000-8000-000000000002";
const publicObjectId = "10000000-0000-4000-8000-000000000003";
const nonexistentProductId = "00000000-0000-4000-8000-000000000099";

let anonClient: SupabaseClient<Database>;
let ownerClient: SupabaseClient<Database>;
let unrelatedClient: SupabaseClient<Database>;
let serviceRoleClient: SupabaseClient<Database>;
let ownedProductId: string;

function objectPath(objectId: string, extension: string, productId = ownedProductId) {
  return `products/${productId}/${objectId}.${extension}`;
}

async function upload(
  client: SupabaseClient<Database>,
  path: string,
  bytes: Uint8Array,
  contentType: string,
  upsert = false,
) {
  return client.storage.from(bucketName).upload(path, bytes, { contentType, upsert });
}

beforeAll(async () => {
  serviceRoleClient = createServiceRoleClient();
  anonClient = createAnonClient();
  ownerClient = await createAuthenticatedAdminClient();
  unrelatedClient = await createUnrelatedAuthenticatedClient();

  const admin = readProvisionedAdmin();
  const { data: seller, error: sellerError } = await serviceRoleClient
    .from("sellers")
    .select("id")
    .eq("store_slug", admin.storeSlug)
    .single();
  if (sellerError || !seller) throw new Error("Provisioned seller row not found");

  const untypedClient = serviceRoleClient as SupabaseClient<Database> & {
    from(table: "products"): ReturnType<SupabaseClient["from"]>;
  };
  const { data: product, error: productError } = await untypedClient
    .from("products")
    .upsert(
      {
        seller_id: seller.id,
        slug: "storage-policy-product",
        name: "Storage Policy Product",
        price: 1000,
        stock: 1,
        weight_grams: 100,
      },
      { onConflict: "seller_id,slug" },
    )
    .select("id")
    .single();
  if (productError || !product) throw new Error("Storage test product could not be created");
  ownedProductId = product.id as string;
});

describe("product image Storage", () => {
  it("exposes a public bucket restricted to the approved MIME types and 2 MB", async () => {
    const { data, error } = await serviceRoleClient.storage.getBucket(bucketName);

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: bucketName,
      public: true,
      file_size_limit: 2 * 1024 * 1024,
      allowed_mime_types: ["image/jpeg", "image/png", "image/webp"],
    });
  });

  it.each([storageImageFixtures.jpeg, storageImageFixtures.png, storageImageFixtures.webp])(
    "allows the owner to upload $contentType to a UUID path",
    async (fixture) => {
      const id = crypto.randomUUID();
      const path = objectPath(id, fixture.extension);
      const { error } = await upload(ownerClient, path, fixture.bytes, fixture.contentType);

      expect(error).toBeNull();
      await ownerClient.storage.from(bucketName).remove([path]);
    },
  );

  it("allows public download of an intended object", async () => {
    const path = objectPath(publicObjectId, storageImageFixtures.jpeg.extension);
    const uploaded = await upload(
      ownerClient,
      path,
      storageImageFixtures.jpeg.bytes,
      storageImageFixtures.jpeg.contentType,
    );
    expect(uploaded.error).toBeNull();

    const { data, error } = await anonClient.storage.from(bucketName).download(path);

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    await ownerClient.storage.from(bucketName).remove([path]);
  });

  it("rejects anonymous uploads", async () => {
    const { error } = await upload(
      anonClient,
      objectPath(crypto.randomUUID(), "jpg"),
      storageImageFixtures.jpeg.bytes,
      storageImageFixtures.jpeg.contentType,
    );

    expect(error).not.toBeNull();
  });

  it("rejects SVG uploads", async () => {
    const { error } = await upload(
      ownerClient,
      objectPath(crypto.randomUUID(), storageImageFixtures.svg.extension),
      storageImageFixtures.svg.bytes,
      storageImageFixtures.svg.contentType,
    );

    expect(error).not.toBeNull();
  });

  it("rejects uploads larger than 2 MB", async () => {
    const { error } = await upload(
      ownerClient,
      objectPath(crypto.randomUUID(), "jpg"),
      createOversizedImageFixture(),
      storageImageFixtures.jpeg.contentType,
    );

    expect(error).not.toBeNull();
  });

  it.each([
    `products/${ownedProductId}/not-a-uuid.jpg`,
    `${ownedProductId}/${crypto.randomUUID()}.jpg`,
    `products/${ownedProductId}/${crypto.randomUUID()}.gif`,
    objectPath(crypto.randomUUID(), "jpg", nonexistentProductId),
  ])("rejects an invalid object path: %s", async (path) => {
    const { error } = await upload(
      ownerClient,
      path,
      storageImageFixtures.jpeg.bytes,
      storageImageFixtures.jpeg.contentType,
    );

    expect(error).not.toBeNull();
  });

  it("rejects uploads to a product the authenticated user does not own", async () => {
    const { error } = await upload(
      unrelatedClient,
      objectPath(crypto.randomUUID(), "jpg"),
      storageImageFixtures.jpeg.bytes,
      storageImageFixtures.jpeg.contentType,
    );

    expect(error).not.toBeNull();
  });

  it("rejects overwrite and upsert while preserving the original object", async () => {
    const path = objectPath(duplicateObjectId, "jpg");
    const original = storageImageFixtures.jpeg.bytes;
    expect((await upload(ownerClient, path, original, "image/jpeg")).error).toBeNull();

    const replacement = Uint8Array.from([...original, 0x00]);
    expect((await upload(ownerClient, path, replacement, "image/jpeg")).error).not.toBeNull();
    expect((await upload(ownerClient, path, replacement, "image/jpeg", true)).error).not.toBeNull();

    const { data, error } = await anonClient.storage.from(bucketName).download(path);
    expect(error).toBeNull();
    expect(new Uint8Array(await data!.arrayBuffer())).toEqual(original);
    await ownerClient.storage.from(bucketName).remove([path]);
  });

  it("allows only the product owner to delete an object", async () => {
    const path = objectPath(validObjectId, "jpg");
    expect(
      (await upload(ownerClient, path, storageImageFixtures.jpeg.bytes, "image/jpeg")).error,
    ).toBeNull();

    const unrelatedDelete = await unrelatedClient.storage.from(bucketName).remove([path]);
    expect(unrelatedDelete.error).not.toBeNull();
    expect((await anonClient.storage.from(bucketName).download(path)).error).toBeNull();

    const ownerDelete = await ownerClient.storage.from(bucketName).remove([path]);
    expect(ownerDelete.error).toBeNull();
    expect((await anonClient.storage.from(bucketName).download(path)).error).not.toBeNull();
  });
});
