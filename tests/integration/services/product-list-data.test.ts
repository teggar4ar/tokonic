import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { listOwnedProducts } from "../../../src/server/data/products";

const sellerId = "20000000-0000-4000-8000-000000000001";
const rows = [
  {
    id: "30000000-0000-4000-8000-000000000003",
    name: "Kopi Tokonic",
    slug: "kopi-tokonic",
    price: 25_000,
    stock: 10,
    is_published: true,
  },
  {
    id: "30000000-0000-4000-8000-000000000004",
    name: "Teh Tokonic",
    slug: "teh-tokonic",
    price: 15_000,
    stock: 0,
    is_published: false,
  },
];

function queryChain(result: { data: unknown; error: unknown }) {
  const order = vi.fn().mockResolvedValue(result);
  const eq = vi.fn().mockReturnValue({ order });
  const select = vi.fn().mockReturnValue({ eq });
  const from = vi.fn().mockReturnValue({ select });
  mocks.createClient.mockResolvedValue({ from });
  return { from, select, eq, order };
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    userId: "10000000-0000-4000-8000-000000000001",
    sellerId,
  });
});

describe("admin product list data", () => {
  it("independently authorizes and scopes the query to the authenticated seller", async () => {
    const chain = queryChain({ data: rows, error: null });

    await listOwnedProducts();

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(chain.from).toHaveBeenCalledWith("products");
    expect(chain.eq).toHaveBeenCalledWith("seller_id", sellerId);
  });

  it("maps rows to a safe view model with string rupiah prices", async () => {
    queryChain({ data: rows, error: null });

    const products = await listOwnedProducts();

    expect(products).toEqual([
      {
        id: rows[0].id,
        name: "Kopi Tokonic",
        slug: "kopi-tokonic",
        priceRupiah: "25000",
        stock: 10,
        isPublished: true,
      },
      {
        id: rows[1].id,
        name: "Teh Tokonic",
        slug: "teh-tokonic",
        priceRupiah: "15000",
        stock: 0,
        isPublished: false,
      },
    ]);
  });

  it("rejects a session without a linked seller before querying", async () => {
    const chain = queryChain({ data: rows, error: null });
    mocks.requireAdmin.mockRejectedValue(new Error("no session"));

    await expect(listOwnedProducts()).rejects.toThrow();
    expect(chain.from).not.toHaveBeenCalled();
  });

  it("throws a safe typed error without leaking database details", async () => {
    queryChain({ data: null, error: { message: "postgres secret detail" } });

    const error = await listOwnedProducts().catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR" });
    expect((error as Error).message).not.toContain("postgres");
  });
});
