import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { listPublishedProducts } from "../../../src/server/data/products";
import { getPublicStoreProfile } from "../../../src/server/data/seller";

const productRows = [
  {
    id: "30000000-0000-4000-8000-000000000003",
    slug: "kopi-tokonic",
    name: "Kopi Tokonic",
    price: 25_000,
    stock: 10,
    product_images: [
      { object_path: "products/30000000-0000-4000-8000-000000000003/a.webp", display_order: 1 },
      { object_path: "products/30000000-0000-4000-8000-000000000003/b.webp", display_order: 0 },
    ],
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    slug: "teh-tokonic",
    name: "Teh Tokonic",
    price: 15_000,
    stock: 0,
    product_images: [],
  },
];

const sellerRow = {
  store_name: "Toko Kopi Tegar",
  store_slug: "toko-kopi-tegar",
  logo_bucket: null,
  logo_path: null,
};

function catalogQueryChain(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  mocks.createClient.mockResolvedValue({ from });
  return { from, select, eq, order };
}

function profileQueryChain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const limit = vi.fn().mockReturnValue({ maybeSingle });
  const select = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ select });
  mocks.createClient.mockResolvedValue({ from });
  return { from, select, limit };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("storefront catalog data", () => {
  it("reads only published products without requiring a session", async () => {
    const chain = catalogQueryChain({ data: productRows, error: null });

    await listPublishedProducts();

    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalledWith("products");
    expect(chain.eq).toHaveBeenCalledWith("is_published", true);
  });

  it("selects only public-safe columns", async () => {
    const chain = catalogQueryChain({ data: productRows, error: null });

    await listPublishedProducts();

    const selectedColumns = chain.select.mock.calls[0][0] as string;
    expect(selectedColumns).toContain("id");
    expect(selectedColumns).toContain("slug");
    expect(selectedColumns).toContain("name");
    expect(selectedColumns).toContain("price");
    expect(selectedColumns).toContain("stock");
    expect(selectedColumns).not.toContain("seller_id");
    expect(selectedColumns).not.toContain("description");
    expect(selectedColumns).not.toContain("weight_grams");
  });

  it("maps rows to a catalog view model with the primary image path", async () => {
    catalogQueryChain({ data: productRows, error: null });

    const products = await listPublishedProducts();

    expect(products).toEqual([
      {
        id: productRows[0].id,
        slug: "kopi-tokonic",
        name: "Kopi Tokonic",
        priceRupiah: "25000",
        stock: 10,
        primaryImagePath: "products/30000000-0000-4000-8000-000000000003/b.webp",
      },
      {
        id: productRows[1].id,
        slug: "teh-tokonic",
        name: "Teh Tokonic",
        priceRupiah: "15000",
        stock: 0,
        primaryImagePath: null,
      },
    ]);
  });

  it("throws a safe typed error without leaking database details", async () => {
    catalogQueryChain({ data: null, error: { message: "postgres secret detail" } });

    const error = await listPublishedProducts().catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR" });
    expect((error as Error).message).not.toContain("postgres");
  });
});

describe("public store profile data", () => {
  it("reads only public profile columns without requiring a session", async () => {
    const chain = profileQueryChain({ data: sellerRow, error: null });

    await getPublicStoreProfile();

    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalledWith("sellers");
    const selectedColumns = chain.select.mock.calls[0][0] as string;
    expect(selectedColumns).toContain("store_name");
    expect(selectedColumns).toContain("store_slug");
    expect(selectedColumns).not.toContain("whatsapp_phone");
    expect(selectedColumns).not.toContain("origin_address");
    expect(selectedColumns).not.toContain("origin_rajaongkir_id");
  });

  it("maps the profile to a public view model", async () => {
    profileQueryChain({ data: sellerRow, error: null });

    const profile = await getPublicStoreProfile();

    expect(profile).toEqual({
      storeName: "Toko Kopi Tegar",
      storeSlug: "toko-kopi-tegar",
      logoBucket: null,
      logoPath: null,
    });
  });

  it("returns null when no store profile exists", async () => {
    profileQueryChain({ data: null, error: null });

    const profile = await getPublicStoreProfile();

    expect(profile).toBeNull();
  });

  it("throws a safe typed error without leaking database details", async () => {
    profileQueryChain({ data: null, error: { message: "postgres secret detail" } });

    const error = await getPublicStoreProfile().catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR" });
    expect((error as Error).message).not.toContain("postgres");
  });
});
