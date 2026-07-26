import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  unpublish: vi.fn(),
  hardDelete: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/server/services/product-service", () => ({
  productService: {
    create: mocks.create,
    update: mocks.update,
    unpublish: mocks.unpublish,
    hardDelete: mocks.hardDelete,
  },
}));

import { AppError } from "../../../src/server/errors/app-error";
import {
  createProductAction,
  hardDeleteProductAction,
  unpublishProductAction,
  updateProductAction,
} from "../../../src/actions/products";

const productId = "30000000-0000-4000-8000-000000000003";
const product = {
  name: "Kopi Tokonic",
  slug: "kopi-tokonic",
  description: "Kopi sintetis untuk pengujian.",
  price: 25_000,
  stock: 10,
  weightGrams: 250,
  isPublished: true,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ userId: "40000000-0000-4000-8000-000000000004", sellerId: "10000000-0000-4000-8000-000000000001" });
  mocks.create.mockResolvedValue({ id: productId, ...product });
  mocks.update.mockResolvedValue({ id: productId, ...product });
  mocks.unpublish.mockResolvedValue({ id: productId, ...product, isPublished: false });
  mocks.hardDelete.mockResolvedValue({ id: productId, slug: product.slug });
});

describe("product action revalidation", () => {
  it.each([
    ["create", () => createProductAction(product)],
    ["update", () => updateProductAction({ id: productId, ...product })],
    ["unpublish", () => unpublishProductAction(productId)],
    ["hard-delete", () => hardDeleteProductAction(productId)],
  ] as const)("revalidates admin and storefront routes after %s succeeds", async (_operation, execute) => {
    await expect(execute()).resolves.toMatchObject({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/produk");
  });

  it("independently authorizes every product action before calling its service", async () => {
    const executions = [
      () => createProductAction(product),
      () => updateProductAction({ id: productId, ...product }),
      () => unpublishProductAction(productId),
      () => hardDeleteProductAction(productId),
    ];

    for (const execute of executions) {
      vi.clearAllMocks();
      mocks.requireAdmin.mockRejectedValueOnce(new AppError("UNAUTHENTICATED", "Autentikasi diperlukan."));

      await expect(execute()).resolves.toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
      expect(mocks.create).not.toHaveBeenCalled();
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.unpublish).not.toHaveBeenCalled();
      expect(mocks.hardDelete).not.toHaveBeenCalled();
    }
  });

  it("revalidates old and current product detail paths after a slug update", async () => {
    await updateProductAction({ id: productId, ...product, slug: "kopi-baru", previousSlug: product.slug });

    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produk/kopi-tokonic");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/produk/kopi-baru");
  });

  it.each(["../admin", "kopi/rahasia", "/produk-lain", "Kopi-Besar", "kopi baru"])(
    "rejects unsafe previousSlug %j without service calls or arbitrary revalidation",
    async (previousSlug) => {
      await expect(updateProductAction({ id: productId, ...product, previousSlug })).resolves.toMatchObject({
        ok: false,
        error: { code: "VALIDATION_ERROR" },
      });
      expect(mocks.update).not.toHaveBeenCalled();
      expect(mocks.revalidatePath).not.toHaveBeenCalled();
    },
  );

  it("revalidates the deleted product detail path", async () => {
    await hardDeleteProductAction(productId);

    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/produk/${product.slug}`);
  });

  it("returns a safe action error and does not revalidate after an unexpected failure", async () => {
    mocks.update.mockRejectedValue(new Error("postgres secret detail"));

    await expect(updateProductAction({ id: productId, ...product })).resolves.toEqual({
      ok: false,
      error: { code: "INTERNAL_ERROR", message: expect.not.stringContaining("postgres") },
    });
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
