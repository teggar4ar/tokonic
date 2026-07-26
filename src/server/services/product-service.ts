import "server-only";

import { requireAdmin } from "../../lib/auth/require-admin";
import {
  productCreateSchema,
  productIdSchema,
  productUpdateSchema,
  type ProductCreateInput,
  type ProductUpdateInput,
} from "../../lib/validation/products";
import {
  createProduct,
  hardDeleteOwnedProduct,
  listOwnedProductImagePaths,
  removeOwnedProductImageObjects,
  unpublishOwnedProduct,
  updateOwnedProduct,
} from "../data/products";
import { AppError } from "../errors/app-error";

export type ProductServiceDependencies = {
  requireAdmin: typeof requireAdmin;
  create: typeof createProduct;
  updateOwned: typeof updateOwnedProduct;
  unpublishOwned: typeof unpublishOwnedProduct;
  listOwnedImagePaths?: typeof listOwnedProductImagePaths;
  removeImageObjects?: typeof removeOwnedProductImageObjects;
  hardDeleteOwned: typeof hardDeleteOwnedProduct;
  finalizeHardDeleteOwned?: typeof hardDeleteOwnedProduct;
};

function safeFailure(error: unknown): never {
  if (error instanceof AppError) {
    throw error;
  }

  throw new AppError("INTERNAL_ERROR", "Operasi produk gagal.", { cause: error });
}

export function createProductService(dependencies: ProductServiceDependencies) {
  return {
    async create(input: ProductCreateInput) {
      try {
        const parsed = productCreateSchema.safeParse(input);
        if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Data produk tidak valid.");
        const { sellerId } = await dependencies.requireAdmin();
        return await dependencies.create(sellerId, parsed.data);
      } catch (error) {
        safeFailure(error);
      }
    },

    async update(input: ProductUpdateInput) {
      try {
        const parsed = productUpdateSchema.safeParse(input);
        if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Data produk tidak valid.");
        const { id, ...values } = parsed.data;
        const { sellerId } = await dependencies.requireAdmin();
        return await dependencies.updateOwned(sellerId, id, values);
      } catch (error) {
        safeFailure(error);
      }
    },

    async unpublish(productId: string) {
      try {
        const parsedId = productIdSchema.safeParse(productId);
        if (!parsedId.success) throw new AppError("VALIDATION_ERROR", "Produk tidak valid.");
        const { sellerId } = await dependencies.requireAdmin();
        return await dependencies.unpublishOwned(sellerId, parsedId.data);
      } catch (error) {
        safeFailure(error);
      }
    },

    async hardDelete(productId: string) {
      try {
        const parsedId = productIdSchema.safeParse(productId);
        if (!parsedId.success) throw new AppError("VALIDATION_ERROR", "Produk tidak valid.");
        const { sellerId } = await dependencies.requireAdmin();
        if (dependencies.listOwnedImagePaths && dependencies.removeImageObjects) {
          const paths = await dependencies.listOwnedImagePaths(sellerId, parsedId.data);
          const outcome = await dependencies.removeImageObjects(sellerId, "product-images", paths);
          if (outcome.removed.length + outcome.notFound.length !== paths.length || paths.some((path) => !outcome.removed.includes(path) && !outcome.notFound.includes(path))) {
            throw new AppError("INTERNAL_ERROR", "Penghapusan gambar produk belum lengkap.");
          }
          if (dependencies.finalizeHardDeleteOwned) return await dependencies.finalizeHardDeleteOwned(sellerId, parsedId.data, paths);
        }
        return await dependencies.hardDeleteOwned(sellerId, parsedId.data);
      } catch (error) {
        safeFailure(error);
      }
    },
  };
}

export const productService = createProductService({
  requireAdmin,
  create: createProduct,
  updateOwned: updateOwnedProduct,
  unpublishOwned: unpublishOwnedProduct,
  listOwnedImagePaths: (sellerId, productId) => listOwnedProductImagePaths(sellerId, productId),
  removeImageObjects: (sellerId, bucket, paths) => removeOwnedProductImageObjects(sellerId, bucket, paths),
  hardDeleteOwned: hardDeleteOwnedProduct,
  finalizeHardDeleteOwned: hardDeleteOwnedProduct,
});
