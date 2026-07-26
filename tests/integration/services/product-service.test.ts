import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("../../../src/server/data/products", () => ({
  createProduct: vi.fn(),
  updateOwnedProduct: vi.fn(),
  unpublishOwnedProduct: vi.fn(),
  hardDeleteOwnedProduct: vi.fn(),
}));

import { AppError } from "../../../src/server/errors/app-error";
import {
  createProductService,
  type ProductServiceDependencies,
} from "../../../src/server/services/product-service";

const sellerId = "10000000-0000-4000-8000-000000000001";
const otherSellerId = "20000000-0000-4000-8000-000000000002";
const productId = "30000000-0000-4000-8000-000000000003";
const input = {
  name: "Kopi Tokonic",
  slug: "kopi-tokonic",
  description: "Kopi sintetis untuk pengujian.",
  price: 25_000,
  stock: 10,
  weightGrams: 250,
  isPublished: true,
};

function dependencies(overrides: Partial<ProductServiceDependencies> = {}): ProductServiceDependencies {
  return {
    requireAdmin: vi.fn().mockResolvedValue({ userId: "40000000-0000-4000-8000-000000000004", sellerId }),
    create: vi.fn().mockResolvedValue({ id: productId, sellerId, ...input }),
    updateOwned: vi.fn().mockResolvedValue({ id: productId, sellerId, ...input }),
    unpublishOwned: vi.fn().mockResolvedValue({ id: productId, sellerId, isPublished: false }),
    hardDeleteOwned: vi.fn().mockResolvedValue({ id: productId, sellerId, slug: input.slug }),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("product service", () => {
  it("authorizes independently and scopes create to the authenticated seller", async () => {
    const deps = dependencies();
    const service = createProductService(deps);

    await expect(service.create(input)).resolves.toEqual(expect.objectContaining({ id: productId }));
    expect(deps.requireAdmin).toHaveBeenCalledOnce();
    expect(deps.create).toHaveBeenCalledWith(sellerId, input);
  });

  it.each(["update", "unpublish", "hardDelete"] as const)(
    "authorizes independently and scopes %s by product and seller",
    async (operation) => {
      const deps = dependencies();
      const service = createProductService(deps);

      if (operation === "update") await service.update({ id: productId, ...input });
      if (operation === "unpublish") await service.unpublish(productId);
      if (operation === "hardDelete") await service.hardDelete(productId);

      expect(deps.requireAdmin).toHaveBeenCalledOnce();
      if (operation === "update") expect(deps.updateOwned).toHaveBeenCalledWith(sellerId, productId, input);
      if (operation === "unpublish") expect(deps.unpublishOwned).toHaveBeenCalledWith(sellerId, productId);
      if (operation === "hardDelete") expect(deps.hardDeleteOwned).toHaveBeenCalledWith(sellerId, productId);
    },
  );

  it("rejects an unrelated seller without retrying an unscoped mutation", async () => {
    const deps = dependencies({
      requireAdmin: vi.fn().mockResolvedValue({ userId: "50000000-0000-4000-8000-000000000005", sellerId: otherSellerId }),
      updateOwned: vi.fn().mockRejectedValue(new AppError("NOT_FOUND", "Produk tidak ditemukan.")),
    });
    const service = createProductService(deps);

    await expect(service.update({ id: productId, ...input })).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deps.updateOwned).toHaveBeenCalledWith(otherSellerId, productId, input);
    expect(deps.updateOwned).toHaveBeenCalledOnce();
  });

  it("hard-deletes an owned product in Phase 2 without an order-reference lookup", async () => {
    const deps = dependencies();
    const service = createProductService(deps);

    await expect(service.hardDelete(productId)).resolves.toEqual(expect.objectContaining({ id: productId }));
    expect(deps.hardDeleteOwned).toHaveBeenCalledWith(sellerId, productId);
    expect(Object.keys(deps)).not.toContain("hasOrderItemReferences");
  });

  it.each(["create", "update", "unpublish", "hardDelete"] as const)(
    "preserves typed errors and sanitizes unexpected %s failures",
    async (operation) => {
      const adapterName = operation === "create" ? "create" : operation === "update" ? "updateOwned" : operation === "unpublish" ? "unpublishOwned" : "hardDeleteOwned";
      const deps = dependencies({ [adapterName]: vi.fn().mockRejectedValue(new Error("postgres secret detail")) });
      const service = createProductService(deps);
      const call = operation === "create"
        ? service.create(input)
        : operation === "update"
          ? service.update({ id: productId, ...input })
          : operation === "unpublish"
            ? service.unpublish(productId)
            : service.hardDelete(productId);

      const error = await call.catch((reason: unknown) => reason);

      expect(error).toMatchObject({ code: "INTERNAL_ERROR" });
      expect(error).toBeInstanceOf(AppError);
      expect((error as Error).message).not.toContain("postgres secret detail");
    },
  );
});
