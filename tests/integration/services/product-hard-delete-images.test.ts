import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("../../../src/server/data/products", () => ({
  createProduct: vi.fn(),
  updateOwnedProduct: vi.fn(),
  unpublishOwnedProduct: vi.fn(),
  hardDeleteOwnedProduct: vi.fn(),
}));

import {
  createProductService,
  type ProductServiceDependencies,
} from "../../../src/server/services/product-service";

const sellerId = "10000000-0000-4000-8000-000000000001";
const productId = "30000000-0000-4000-8000-000000000003";
const paths = [
  `products/${productId}/60000000-0000-4000-8000-000000000006.jpg`,
  `products/${productId}/70000000-0000-4000-8000-000000000007.webp`,
];

function dependencies(overrides: Partial<ProductServiceDependencies> = {}): ProductServiceDependencies {
  return {
    requireAdmin: vi.fn().mockResolvedValue({ userId: "40000000-0000-4000-8000-000000000004", sellerId }),
    create: vi.fn(),
    updateOwned: vi.fn(),
    unpublishOwned: vi.fn(),
    listOwnedImagePaths: vi.fn().mockResolvedValue(paths),
    removeImageObjects: vi.fn().mockResolvedValue({ removed: paths, notFound: [] }),
    hardDeleteOwned: vi.fn().mockResolvedValue({ id: productId, sellerId, slug: "kopi-tokonic" }),
    ...overrides,
  };
}

describe("product hard-delete Storage lifecycle", () => {
  it("enumerates and deletes owned Storage objects before deleting the database product", async () => {
    const deps = dependencies();
    const service = createProductService(deps);

    await service.hardDelete(productId);

    expect(deps.listOwnedImagePaths).toHaveBeenCalledWith(sellerId, productId);
    expect(deps.removeImageObjects).toHaveBeenCalledWith(sellerId, "product-images", paths);
    expect(deps.hardDeleteOwned).toHaveBeenCalledWith(sellerId, productId);
    expect(vi.mocked(deps.removeImageObjects!).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deps.hardDeleteOwned).mock.invocationCallOrder[0]);
  });

  it("continues database deletion when all missing objects return not-found", async () => {
    const deps = dependencies({ removeImageObjects: vi.fn().mockResolvedValue({ removed: [], notFound: paths }) });
    const service = createProductService(deps);

    await expect(service.hardDelete(productId)).resolves.toMatchObject({ id: productId });
    expect(deps.hardDeleteOwned).toHaveBeenCalledOnce();
  });

  it("preserves the database product when Storage returns only a partial outcome", async () => {
    const deps = dependencies({ removeImageObjects: vi.fn().mockResolvedValue({ removed: [paths[0]], notFound: [] }) });
    const service = createProductService(deps);

    await expect(service.hardDelete(productId)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(deps.hardDeleteOwned).not.toHaveBeenCalled();
  });

  it("preserves the database product on non-not-found Storage failure", async () => {
    const deps = dependencies({ removeImageObjects: vi.fn().mockRejectedValue(new Error("storage unavailable")) });
    const service = createProductService(deps);

    await expect(service.hardDelete(productId)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(deps.hardDeleteOwned).not.toHaveBeenCalled();
  });
});
