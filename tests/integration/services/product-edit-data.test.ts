import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getOwnedProduct, listOwnedProductImages } from "../../../src/server/data/products";

const sellerId = "20000000-0000-4000-8000-000000000001";
const productId = "30000000-0000-4000-8000-000000000003";

const productRow = {
  id: productId,
  name: "Kopi Tokonic",
  slug: "kopi-tokonic",
  description: "Kopi bubuk 200 gram.",
  price: 25_000,
  stock: 10,
  weight_grams: 250,
  is_published: true,
};

const imageRows = [
  {
    id: "40000000-0000-4000-8000-000000000001",
    object_path: `products/${productId}/50000000-0000-4000-8000-000000000001.webp`,
    display_order: 0,
  },
  {
    id: "40000000-0000-4000-8000-000000000002",
    object_path: `products/${productId}/50000000-0000-4000-8000-000000000002.jpg`,
    display_order: 1,
  },
];

function productQueryChain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const eqSeller = vi.fn().mockReturnValue({ maybeSingle });
  const eqId = vi.fn().mockReturnValue({ eq: eqSeller });
  const select = vi.fn().mockReturnValue({ eq: eqId });
  const from = vi.fn().mockReturnValue({ select });
  mocks.createClient.mockResolvedValue({ from });
  return { from, select, eqId, eqSeller };
}

function imageQueryChain(
  productResult: { data: unknown; error: unknown },
  imagesResult: { data: unknown; error: unknown },
) {
  const maybeSingle = vi.fn().mockResolvedValue(productResult);
  const productEqSeller = vi.fn().mockReturnValue({ maybeSingle });
  const productEqId = vi.fn().mockReturnValue({ eq: productEqSeller });
  const productSelect = vi.fn().mockReturnValue({ eq: productEqId });

  const order = vi.fn().mockResolvedValue(imagesResult);
  const imagesEq = vi.fn().mockReturnValue({ order });
  const imagesSelect = vi.fn().mockReturnValue({ eq: imagesEq });

  const from = vi.fn((table: string) =>
    table === "products" ? { select: productSelect } : { select: imagesSelect },
  );
  mocks.createClient.mockResolvedValue({ from });
  return { from, productEqId, productEqSeller, imagesEq, order };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    userId: "10000000-0000-4000-8000-000000000001",
    sellerId,
  });
});

describe("admin product edit data", () => {
  it("independently authorizes and scopes the product read to the authenticated seller", async () => {
    const chain = productQueryChain({ data: productRow, error: null });

    await getOwnedProduct(productId);

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(chain.from).toHaveBeenCalledWith("products");
    expect(chain.eqId).toHaveBeenCalledWith("id", productId);
    expect(chain.eqSeller).toHaveBeenCalledWith("seller_id", sellerId);
  });

  it("maps the owned product to an editable view model with integer-safe fields", async () => {
    productQueryChain({ data: productRow, error: null });

    const product = await getOwnedProduct(productId);

    expect(product).toEqual({
      id: productId,
      name: "Kopi Tokonic",
      slug: "kopi-tokonic",
      description: "Kopi bubuk 200 gram.",
      price: 25_000,
      stock: 10,
      weightGrams: 250,
      isPublished: true,
    });
  });

  it("throws NOT_FOUND for a product the seller does not own", async () => {
    productQueryChain({ data: null, error: null });

    const error = await getOwnedProduct(productId).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });

  it("rejects a session without a linked seller before querying", async () => {
    const chain = productQueryChain({ data: productRow, error: null });
    mocks.requireAdmin.mockRejectedValue(new Error("no session"));

    await expect(getOwnedProduct(productId)).rejects.toThrow();
    expect(chain.from).not.toHaveBeenCalled();
  });

  it("throws a safe typed error without leaking database details", async () => {
    productQueryChain({ data: null, error: { message: "postgres secret detail" } });

    const error = await getOwnedProduct(productId).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR" });
    expect((error as Error).message).not.toContain("postgres");
  });

  it("lists images only after verifying product ownership, ordered by display order", async () => {
    const chain = imageQueryChain(
      { data: { id: productId }, error: null },
      { data: imageRows, error: null },
    );

    const images = await listOwnedProductImages(productId);

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(chain.productEqSeller).toHaveBeenCalledWith("seller_id", sellerId);
    expect(chain.imagesEq).toHaveBeenCalledWith("product_id", productId);
    expect(chain.order).toHaveBeenCalledWith("display_order", { ascending: true });
    expect(images).toEqual([
      { id: imageRows[0].id, objectPath: imageRows[0].object_path, displayOrder: 0 },
      { id: imageRows[1].id, objectPath: imageRows[1].object_path, displayOrder: 1 },
    ]);
  });

  it("throws NOT_FOUND when listing images for an unowned product", async () => {
    imageQueryChain({ data: null, error: null }, { data: imageRows, error: null });

    const error = await listOwnedProductImages(productId).catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "NOT_FOUND" });
  });
});
