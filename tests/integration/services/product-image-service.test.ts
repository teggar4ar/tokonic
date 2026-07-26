import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: vi.fn() }));
vi.mock("../../../src/server/data/product-images", () => ({
  assertOwnedProduct: vi.fn(),
  countOwnedProductImages: vi.fn(),
  deleteProductImageMetadata: vi.fn(),
  getOwnedProductImage: vi.fn(),
  insertProductImageMetadata: vi.fn(),
  removeOwnedStorageObjects: vi.fn(),
  updateProductImageMetadata: vi.fn(),
  verifyOwnedStorageObject: vi.fn(),
}));

import { AppError } from "../../../src/server/errors/app-error";
import {
  createProductImageService,
  type ProductImageServiceDependencies,
} from "../../../src/server/services/product-image-service";

const sellerId = "10000000-0000-4000-8000-000000000001";
const productId = "30000000-0000-4000-8000-000000000003";
const imageId = "60000000-0000-4000-8000-000000000006";
const replacementId = "70000000-0000-4000-8000-000000000007";
const oldPath = `products/${productId}/${imageId}.jpg`;
const newPath = `products/${productId}/${replacementId}.png`;
const metadata = {
  productId,
  objectPath: oldPath,
  mimeType: "image/jpeg",
  byteSize: 8,
  width: 800,
  height: 600,
  displayOrder: 0,
};

function dependencies(overrides: Partial<ProductImageServiceDependencies> = {}): ProductImageServiceDependencies {
  return {
    requireAdmin: vi.fn().mockResolvedValue({ userId: "40000000-0000-4000-8000-000000000004", sellerId }),
    assertOwnedProduct: vi.fn().mockResolvedValue(undefined),
    countImages: vi.fn().mockResolvedValue(0),
    getOwnedImage: vi.fn().mockResolvedValue({ id: imageId, sellerId, ...metadata }),
    verifyObject: vi.fn().mockImplementation(async (_sellerId, _bucket, objectPath) => objectPath === newPath
      ? { exists: true, contentType: "image/png", actualMimeType: "image/png", byteSize: 12, width: 900, height: 700 }
      : { exists: true, contentType: metadata.mimeType, actualMimeType: metadata.mimeType, byteSize: metadata.byteSize, width: metadata.width, height: metadata.height }),
    insertMetadata: vi.fn().mockResolvedValue({ id: imageId, ...metadata }),
    updateMetadata: vi.fn().mockResolvedValue({ id: imageId, ...metadata, objectPath: newPath, mimeType: "image/png" }),
    deleteMetadata: vi.fn().mockResolvedValue(undefined),
    removeObjects: vi.fn().mockResolvedValue({ removed: [oldPath], notFound: [] }),
    ...overrides,
  };
}

describe("product image service", () => {
  it("independently authorizes, verifies ownership and Storage metadata before inserting metadata", async () => {
    const deps = dependencies();
    const service = createProductImageService(deps);

    await service.register(metadata);

    expect(deps.requireAdmin).toHaveBeenCalledOnce();
    expect(deps.assertOwnedProduct).toHaveBeenCalledWith(sellerId, productId);
    expect(deps.verifyObject).toHaveBeenCalledWith(sellerId, "product-images", oldPath);
    expect(deps.insertMetadata).toHaveBeenCalledWith(sellerId, metadata);
    expect(vi.mocked(deps.verifyObject).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deps.insertMetadata).mock.invocationCallOrder[0]);
  });

  it.each([
    ["missing object", { exists: false }],
    ["oversized object", { exists: true, contentType: "image/jpeg", byteSize: 2 * 1024 * 1024 + 1 }],
    ["content type mismatch", { exists: true, contentType: "image/png", byteSize: 8 }],
  ])("rejects %s and cleans the unregistered object", async (_label, object) => {
    const deps = dependencies({ verifyObject: vi.fn().mockResolvedValue(object) });
    const service = createProductImageService(deps);

    await expect(service.register(metadata)).rejects.toBeInstanceOf(AppError);
    expect(deps.insertMetadata).not.toHaveBeenCalled();
    expect(deps.removeObjects).toHaveBeenCalledWith(sellerId, "product-images", [oldPath]);
  });

  it.each([
    ["decoded dimensions", { exists: true, contentType: "image/jpeg", byteSize: 8, width: 799, height: 600, actualMimeType: "image/jpeg" }],
    ["actual byte format", { exists: true, contentType: "image/jpeg", byteSize: 8, width: 800, height: 600, actualMimeType: "image/png" }],
  ])("rejects client metadata that disagrees with authoritative %s", async (_label, object) => {
    const deps = dependencies({ verifyObject: vi.fn().mockResolvedValue(object) });
    const service = createProductImageService(deps);

    await expect(service.register(metadata)).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
    expect(deps.insertMetadata).not.toHaveBeenCalled();
  });

  it("does not delete a candidate that was not positively identified as the caller's new upload", async () => {
    const deps = dependencies({ assertOwnedProduct: vi.fn().mockRejectedValue(new AppError("NOT_FOUND", "Produk tidak ditemukan.")) });
    const service = createProductImageService(deps);

    await expect(service.register(metadata)).rejects.toMatchObject({ code: "NOT_FOUND" });
    expect(deps.removeObjects).not.toHaveBeenCalled();
  });

  it("rejects a sixth image before metadata insertion", async () => {
    const deps = dependencies({ countImages: vi.fn().mockResolvedValue(5) });
    const service = createProductImageService(deps);

    await expect(service.register(metadata)).rejects.toMatchObject({ code: "CONFLICT" });
    expect(deps.verifyObject).not.toHaveBeenCalled();
    expect(deps.insertMetadata).not.toHaveBeenCalled();
  });

  it("attempts orphan cleanup when metadata insertion fails", async () => {
    const deps = dependencies({ insertMetadata: vi.fn().mockRejectedValue(new Error("database failure")) });
    const service = createProductImageService(deps);

    await expect(service.register(metadata)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(deps.removeObjects).toHaveBeenCalledWith(sellerId, "product-images", [oldPath]);
  });

  it("deletes metadata after Storage deletion succeeds", async () => {
    const deps = dependencies();
    const service = createProductImageService(deps);

    await service.remove(imageId);

    expect(deps.removeObjects).toHaveBeenCalledWith(sellerId, "product-images", [oldPath]);
    expect(deps.deleteMetadata).toHaveBeenCalledWith(sellerId, imageId);
    expect(vi.mocked(deps.removeObjects).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(deps.deleteMetadata).mock.invocationCallOrder[0]);
  });

  it("allows metadata cleanup when Storage reports not found", async () => {
    const deps = dependencies({ removeObjects: vi.fn().mockResolvedValue({ removed: [], notFound: [oldPath] }) });
    const service = createProductImageService(deps);

    await expect(service.remove(imageId)).resolves.toMatchObject({ ok: true });
    expect(deps.deleteMetadata).toHaveBeenCalledWith(sellerId, imageId);
  });

  it("preserves metadata when Storage reports an incomplete successful removal result", async () => {
    const deps = dependencies({ removeObjects: vi.fn().mockResolvedValue({ removed: [], notFound: [] }) });
    const service = createProductImageService(deps);

    await expect(service.remove(imageId)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(deps.deleteMetadata).not.toHaveBeenCalled();
  });

  it("preserves metadata when Storage deletion fails for a non-not-found reason", async () => {
    const deps = dependencies({ removeObjects: vi.fn().mockRejectedValue(new Error("storage unavailable")) });
    const service = createProductImageService(deps);

    await expect(service.remove(imageId)).rejects.toMatchObject({ code: "INTERNAL_ERROR" });
    expect(deps.deleteMetadata).not.toHaveBeenCalled();
  });

  it("replaces with a verified new UUID object while preserving metadata identity and display order", async () => {
    const deps = dependencies();
    const service = createProductImageService(deps);

    await service.replace({ imageId, objectPath: newPath, mimeType: "image/png", byteSize: 12, width: 900, height: 700 });

    expect(deps.verifyObject).toHaveBeenCalledWith(sellerId, "product-images", newPath);
    expect(deps.updateMetadata).toHaveBeenCalledWith(sellerId, imageId, expect.objectContaining({
      objectPath: newPath,
      displayOrder: 0,
    }));
    expect(deps.removeObjects).toHaveBeenCalledWith(sellerId, "product-images", [oldPath]);
  });

  it("keeps a successful replacement and returns orphan follow-up when old cleanup fails", async () => {
    const deps = dependencies({ removeObjects: vi.fn().mockRejectedValue(new Error("storage unavailable")) });
    const service = createProductImageService(deps);

    await expect(service.replace({ imageId, objectPath: newPath, mimeType: "image/png", byteSize: 12, width: 900, height: 700 })).resolves.toEqual(expect.objectContaining({
      ok: true,
      warning: expect.objectContaining({ code: "ORPHAN_CLEANUP_REQUIRED", objectPath: oldPath }),
    }));
    expect(deps.updateMetadata).toHaveBeenCalledOnce();
  });

  it("does not update metadata when replacement verification fails and cleans the new orphan", async () => {
    const deps = dependencies({ verifyObject: vi.fn().mockResolvedValue({ exists: true, contentType: "image/jpeg", byteSize: 12 }) });
    const service = createProductImageService(deps);

    await expect(service.replace({ imageId, objectPath: newPath, mimeType: "image/png", byteSize: 12, width: 900, height: 700 })).rejects.toBeInstanceOf(AppError);
    expect(deps.updateMetadata).not.toHaveBeenCalled();
    expect(deps.removeObjects).toHaveBeenCalledWith(sellerId, "product-images", [newPath]);
  });
});
