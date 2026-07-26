import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { getPublishedProductBySlug } from "../../../src/server/data/products";
import { getPublicStoreContact } from "../../../src/server/data/seller";

const productRow = {
  id: "30000000-0000-4000-8000-000000000003",
  slug: "kopi-tokonic",
  name: "Kopi Tokonic",
  description: "Kopi bubuk 200 gram.",
  price: 25_000,
  stock: 10,
  product_images: [
    { object_path: "products/30000000-0000-4000-8000-000000000003/b.webp", display_order: 1 },
    { object_path: "products/30000000-0000-4000-8000-000000000003/a.webp", display_order: 0 },
  ],
};

function detailQueryChain(result: { data: unknown; error: unknown }) {
  const maybeSingle = vi.fn().mockResolvedValue(result);
  const secondEq = vi.fn().mockReturnValue({ maybeSingle });
  const firstEq = vi.fn().mockReturnValue({ eq: secondEq });
  const select = vi.fn().mockReturnValue({ eq: firstEq });
  const from = vi.fn().mockReturnValue({ select });
  mocks.createClient.mockResolvedValue({ from });
  return { from, select, firstEq, secondEq, maybeSingle };
}

function contactQueryChain(result: { data: unknown; error: unknown }) {
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

describe("published product detail data", () => {
  it("reads only a published product by slug without requiring a session", async () => {
    const chain = detailQueryChain({ data: productRow, error: null });

    await getPublishedProductBySlug("kopi-tokonic");

    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalledWith("products");
    const eqCalls = [chain.firstEq.mock.calls[0], chain.secondEq.mock.calls[0]];
    expect(eqCalls).toContainEqual(["slug", "kopi-tokonic"]);
    expect(eqCalls).toContainEqual(["is_published", true]);
  });

  it("selects only public-safe columns", async () => {
    const chain = detailQueryChain({ data: productRow, error: null });

    await getPublishedProductBySlug("kopi-tokonic");

    const selectedColumns = chain.select.mock.calls[0][0] as string;
    expect(selectedColumns).toContain("description");
    expect(selectedColumns).not.toContain("seller_id");
    expect(selectedColumns).not.toContain("weight_grams");
    expect(selectedColumns).not.toContain("created_at");
  });

  it("maps the row to a detail view model with images in display order", async () => {
    detailQueryChain({ data: productRow, error: null });

    const product = await getPublishedProductBySlug("kopi-tokonic");

    expect(product).toEqual({
      id: productRow.id,
      slug: "kopi-tokonic",
      name: "Kopi Tokonic",
      description: "Kopi bubuk 200 gram.",
      priceRupiah: "25000",
      stock: 10,
      imagePaths: [
        "products/30000000-0000-4000-8000-000000000003/a.webp",
        "products/30000000-0000-4000-8000-000000000003/b.webp",
      ],
    });
  });

  it("returns null for a missing or unpublished slug", async () => {
    detailQueryChain({ data: null, error: null });

    const product = await getPublishedProductBySlug("tidak-ada");

    expect(product).toBeNull();
  });

  it("returns null without querying for an invalid slug shape", async () => {
    const chain = detailQueryChain({ data: productRow, error: null });

    const product = await getPublishedProductBySlug("../rahasia");

    expect(product).toBeNull();
    expect(chain.from).not.toHaveBeenCalled();
  });

  it("throws a safe typed error without leaking database details", async () => {
    detailQueryChain({ data: null, error: { message: "postgres secret detail" } });

    const error = await getPublishedProductBySlug("kopi-tokonic").catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR" });
    expect((error as Error).message).not.toContain("postgres");
  });
});

describe("public store contact data", () => {
  it("reads only the WhatsApp contact column without requiring a session", async () => {
    const chain = contactQueryChain({ data: { whatsapp_phone: "6285712345678" }, error: null });

    await getPublicStoreContact();

    expect(mocks.requireAdmin).not.toHaveBeenCalled();
    expect(chain.from).toHaveBeenCalledWith("sellers");
    const selectedColumns = chain.select.mock.calls[0][0] as string;
    expect(selectedColumns).toContain("whatsapp_phone");
    expect(selectedColumns).not.toContain("origin_address");
    expect(selectedColumns).not.toContain("origin_rajaongkir_id");
    expect(selectedColumns).not.toContain("auth_user_id");
  });

  it("maps the contact to a public view model", async () => {
    contactQueryChain({ data: { whatsapp_phone: "6285712345678" }, error: null });

    const contact = await getPublicStoreContact();

    expect(contact).toEqual({ whatsappPhone: "6285712345678" });
  });

  it("returns null when no store profile exists", async () => {
    contactQueryChain({ data: null, error: null });

    const contact = await getPublicStoreContact();

    expect(contact).toBeNull();
  });

  it("throws a safe typed error without leaking database details", async () => {
    contactQueryChain({ data: null, error: { message: "postgres secret detail" } });

    const error = await getPublicStoreContact().catch((reason: unknown) => reason);

    expect(error).toMatchObject({ code: "INTERNAL_ERROR" });
    expect((error as Error).message).not.toContain("postgres");
  });
});
