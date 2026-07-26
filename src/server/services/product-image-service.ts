import "server-only";

import { requireAdmin } from "../../lib/auth/require-admin";
import {
  productImageBucket,
  productImageIdSchema,
  productImageMaximumBytes,
  productImageMaximumCount,
  productImageMetadataSchema,
  productImageReplacementSchema,
} from "../../lib/validation/product-images";
import {
  assertOwnedProduct,
  countOwnedProductImages,
  deleteProductImageMetadata,
  getOwnedProductImage,
  insertProductImageMetadata,
  removeOwnedStorageObjects,
  updateProductImageMetadata,
  verifyOwnedStorageObject,
} from "../data/product-images";
import { AppError } from "../errors/app-error";

export type ProductImageServiceDependencies = {
  requireAdmin: typeof requireAdmin;
  assertOwnedProduct: typeof assertOwnedProduct;
  countImages: typeof countOwnedProductImages;
  getOwnedImage: typeof getOwnedProductImage;
  verifyObject: typeof verifyOwnedStorageObject;
  insertMetadata: typeof insertProductImageMetadata;
  updateMetadata: typeof updateProductImageMetadata;
  deleteMetadata: typeof deleteProductImageMetadata;
  removeObjects: typeof removeOwnedStorageObjects;
};

function safeFailure(error: unknown): never {
  if (error instanceof AppError) throw error;
  throw new AppError("INTERNAL_ERROR", "Operasi gambar gagal.", { cause: error });
}

function assertPathProduct(path: string, productId: string) {
  if (!path.startsWith(`products/${productId}/`)) throw new AppError("VALIDATION_ERROR", "Path gambar tidak valid.");
}

function assertVerifiedObject(object: { exists: boolean; contentType?: string; byteSize?: number; actualMimeType?: string; width?: number; height?: number }, input: { mimeType: string; byteSize: number; width: number; height: number }) {
  if (!object.exists || object.contentType !== input.mimeType || object.actualMimeType !== input.mimeType || object.byteSize !== input.byteSize || object.width !== input.width || object.height !== input.height || input.byteSize > productImageMaximumBytes) throw new AppError("VALIDATION_ERROR", "Objek gambar tidak valid.");
}

export function createProductImageService(dependencies: ProductImageServiceDependencies) {
  return {
    async register(input: unknown) {
      const parsed = productImageMetadataSchema.safeParse(input);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Metadata gambar tidak valid.");
      const { sellerId } = await dependencies.requireAdmin();
      let shouldCleanup = false;
      try {
        assertPathProduct(parsed.data.objectPath, parsed.data.productId);
        await dependencies.assertOwnedProduct(sellerId, parsed.data.productId);
        if (await dependencies.countImages(sellerId, parsed.data.productId) >= productImageMaximumCount) throw new AppError("CONFLICT", "Produk sudah memiliki lima gambar.");
        const object = await dependencies.verifyObject(sellerId, productImageBucket, parsed.data.objectPath);
        shouldCleanup = true;
        assertVerifiedObject(object, parsed.data);
        return await dependencies.insertMetadata(sellerId, parsed.data);
      } catch (error) {
        if (shouldCleanup || error instanceof AppError && error.code === "VALIDATION_ERROR") {
          await dependencies.removeObjects(sellerId, productImageBucket, [parsed.data.objectPath]).catch(() => undefined);
        }
        safeFailure(error);
      }
    },

    async remove(imageId: string) {
      const parsedId = productImageIdSchema.safeParse(imageId);
      if (!parsedId.success) throw new AppError("VALIDATION_ERROR", "Gambar tidak valid.");
      const { sellerId } = await dependencies.requireAdmin();
      try {
        const image = await dependencies.getOwnedImage(sellerId, parsedId.data);
        const outcome = await dependencies.removeObjects(sellerId, productImageBucket, [image.objectPath]);
        if (!outcome.removed.includes(image.objectPath) && !outcome.notFound.includes(image.objectPath)) throw new AppError("INTERNAL_ERROR", "Penghapusan objek gambar belum lengkap.");
        await dependencies.deleteMetadata(sellerId, parsedId.data);
        return { ok: true as const, productId: image.productId };
      } catch (error) {
        safeFailure(error);
      }
    },

    async replace(input: unknown) {
      const parsed = productImageReplacementSchema.safeParse(input);
      if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Metadata pengganti tidak valid.");
      const { sellerId } = await dependencies.requireAdmin();
      let image: Awaited<ReturnType<ProductImageServiceDependencies["getOwnedImage"]>> | undefined;
      let updated = false;
      try {
        image = await dependencies.getOwnedImage(sellerId, parsed.data.imageId);
        assertPathProduct(parsed.data.objectPath, image.productId);
        if (parsed.data.objectPath === image.objectPath) throw new AppError("VALIDATION_ERROR", "Path pengganti harus baru.");
        const object = await dependencies.verifyObject(sellerId, productImageBucket, parsed.data.objectPath);
        assertVerifiedObject(object, parsed.data);
        const next = await dependencies.updateMetadata(sellerId, image.id, {
          productId: image.productId,
          objectPath: parsed.data.objectPath,
          mimeType: parsed.data.mimeType,
          byteSize: parsed.data.byteSize,
          width: parsed.data.width,
          height: parsed.data.height,
          displayOrder: image.displayOrder,
        });
        updated = true;
        try {
          await dependencies.removeObjects(sellerId, productImageBucket, [image.objectPath]);
          return { ok: true as const, image: next };
        } catch {
          return { ok: true as const, image: next, warning: { code: "ORPHAN_CLEANUP_REQUIRED" as const, objectPath: image.objectPath } };
        }
      } catch (error) {
        if (!updated && image) await dependencies.removeObjects(sellerId, productImageBucket, [parsed.data.objectPath]).catch(() => undefined);
        safeFailure(error);
      }
    },
  };
}

export const productImageService = createProductImageService({
  requireAdmin,
  assertOwnedProduct,
  countImages: countOwnedProductImages,
  getOwnedImage: getOwnedProductImage,
  verifyObject: verifyOwnedStorageObject,
  insertMetadata: insertProductImageMetadata,
  updateMetadata: updateProductImageMetadata,
  deleteMetadata: deleteProductImageMetadata,
  removeObjects: removeOwnedStorageObjects,
});
