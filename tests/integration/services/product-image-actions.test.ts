import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  revalidatePath: vi.fn(),
  requireAdmin: vi.fn(),
  register: vi.fn(),
  remove: vi.fn(),
  replace: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/server/services/product-image-service", () => ({
  productImageService: { register: mocks.register, remove: mocks.remove, replace: mocks.replace },
}));

import { AppError } from "../../../src/server/errors/app-error";
import {
  registerProductImageAction,
  removeProductImageAction,
  replaceProductImageAction,
} from "../../../src/actions/product-images";

const productId = "30000000-0000-4000-8000-000000000003";
const imageId = "60000000-0000-4000-8000-000000000006";
const metadata = {
  productId,
  objectPath: `products/${productId}/${imageId}.jpg`,
  mimeType: "image/jpeg",
  byteSize: 8,
  width: 800,
  height: 600,
  displayOrder: 0,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({ userId: "40000000-0000-4000-8000-000000000004", sellerId: "10000000-0000-4000-8000-000000000001" });
  mocks.register.mockResolvedValue({ id: imageId, ...metadata });
  mocks.remove.mockResolvedValue({ ok: true, productId });
  mocks.replace.mockResolvedValue({ ok: true, image: { id: imageId, ...metadata } });
});

describe("product image actions", () => {
  it.each([
    ["register", () => registerProductImageAction(metadata), mocks.register],
    ["remove", () => removeProductImageAction(imageId), mocks.remove],
    ["replace", () => replaceProductImageAction({ imageId, ...metadata }), mocks.replace],
  ] as const)("independently authorizes %s before calling its service", async (_name, execute, service) => {
    mocks.requireAdmin.mockRejectedValueOnce(new AppError("UNAUTHENTICATED", "Autentikasi diperlukan."));

    await expect(execute()).resolves.toMatchObject({ ok: false, error: { code: "UNAUTHENTICATED" } });
    expect(service).not.toHaveBeenCalled();
  });

  it.each([
    ["register", () => registerProductImageAction(metadata)],
    ["remove", () => removeProductImageAction(imageId)],
    ["replace", () => replaceProductImageAction({ imageId, ...metadata })],
  ] as const)("revalidates product and catalog routes after %s succeeds", async (_name, execute) => {
    await expect(execute()).resolves.toMatchObject({ ok: true });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/");
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/produk");
    expect(mocks.revalidatePath).toHaveBeenCalledWith(`/admin/produk/${productId}`);
  });

  it.each([
    ["register", () => registerProductImageAction({ ...metadata, objectPath: "products/unsafe.jpg" }), mocks.register],
    ["remove", () => removeProductImageAction("not-a-uuid"), mocks.remove],
    ["replace", () => replaceProductImageAction({ ...metadata, imageId: "not-a-uuid" }), mocks.replace],
  ] as const)("validates %s input at the action entry point before invoking the service", async (_name, execute, service) => {
    await expect(execute()).resolves.toMatchObject({ ok: false, error: { code: "VALIDATION_ERROR" } });
    expect(service).not.toHaveBeenCalled();
  });

  it("returns replacement cleanup warnings without converting success to failure", async () => {
    mocks.replace.mockResolvedValue({
      ok: true,
      image: { id: imageId, ...metadata },
      warning: { code: "ORPHAN_CLEANUP_REQUIRED", objectPath: metadata.objectPath },
    });

    await expect(replaceProductImageAction({ imageId, ...metadata })).resolves.toMatchObject({
      ok: true,
      warning: { code: "ORPHAN_CLEANUP_REQUIRED" },
    });
  });
});
