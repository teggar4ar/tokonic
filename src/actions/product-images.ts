"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../lib/auth/require-admin";
import { productImageIdSchema, productImageMetadataSchema, productImageReplacementSchema } from "../lib/validation/product-images";
import type { AppErrorCode } from "../server/errors/app-error";
import { AppError } from "../server/errors/app-error";
import { productImageService } from "../server/services/product-image-service";

function failure(error: unknown) {
  if (error instanceof AppError) return { ok: false as const, error: { code: error.code, message: error.message } };
  return { ok: false as const, error: { code: "INTERNAL_ERROR" as AppErrorCode, message: "Operasi gambar gagal." } };
}

function revalidateImageRoutes(productId: string) {
  revalidatePath("/");
  revalidatePath("/admin/produk");
  revalidatePath(`/admin/produk/${productId}`);
}

export async function registerProductImageAction(input: Parameters<typeof productImageService.register>[0]) {
  try {
    await requireAdmin();
    const parsed = productImageMetadataSchema.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Metadata gambar tidak valid.");
    const image = await productImageService.register(parsed.data);
    revalidateImageRoutes(image.productId);
    return { ok: true as const, data: image };
  } catch (error) {
    return failure(error);
  }
}

export async function removeProductImageAction(imageId: string) {
  try {
    await requireAdmin();
    const parsedId = productImageIdSchema.safeParse(imageId);
    if (!parsedId.success) throw new AppError("VALIDATION_ERROR", "Gambar tidak valid.");
    const result = await productImageService.remove(parsedId.data);
    revalidateImageRoutes(result.productId);
    return { ok: true as const, data: result };
  } catch (error) {
    return failure(error);
  }
}

export async function replaceProductImageAction(input: unknown) {
  try {
    await requireAdmin();
    const parsed = productImageReplacementSchema.safeParse(input);
    if (!parsed.success) throw new AppError("VALIDATION_ERROR", "Metadata pengganti tidak valid.");
    const result = await productImageService.replace(parsed.data);
    revalidateImageRoutes(result.image.productId);
    return { ok: true as const, data: result.image, ...(result.warning ? { warning: result.warning } : {}) };
  } catch (error) {
    return failure(error);
  }
}
