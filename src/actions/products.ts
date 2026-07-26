"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../lib/auth/require-admin";
import { productSlugSchema } from "../lib/validation/products";
import type { AppErrorCode } from "../server/errors/app-error";
import { AppError } from "../server/errors/app-error";
import { productService } from "../server/services/product-service";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: AppErrorCode; message: string } };

type ProductActionInput = Parameters<typeof productService.create>[0];
type ProductUpdateActionInput = Parameters<typeof productService.update>[0] & { previousSlug?: string };

function failure(error: unknown): ActionResult<never> {
  if (error instanceof AppError) {
    return { ok: false, error: { code: error.code, message: error.message } };
  }

  return { ok: false, error: { code: "INTERNAL_ERROR", message: "Operasi produk gagal." } };
}

function revalidateProductRoutes(slugs: string[] = []) {
  revalidatePath("/");
  revalidatePath("/admin/produk");

  for (const slug of new Set(slugs.filter(Boolean))) {
    revalidatePath(`/produk/${slug}`);
  }
}

export async function createProductAction(input: ProductActionInput) {
  try {
    await requireAdmin();
    const product = await productService.create(input);
    revalidateProductRoutes([product.slug]);
    return { ok: true, data: product } as const;
  } catch (error) {
    return failure(error);
  }
}

export async function updateProductAction(input: ProductUpdateActionInput) {
  try {
    await requireAdmin();
    const { previousSlug, ...productInput } = input;
    const parsedPreviousSlug = previousSlug === undefined ? undefined : productSlugSchema.safeParse(previousSlug);

    if (parsedPreviousSlug && !parsedPreviousSlug.success) {
      throw new AppError("VALIDATION_ERROR", "Slug produk sebelumnya tidak valid.");
    }

    const product = await productService.update(productInput);
    revalidateProductRoutes([parsedPreviousSlug?.data ?? "", productInput.slug]);
    return { ok: true, data: product } as const;
  } catch (error) {
    return failure(error);
  }
}

export async function unpublishProductAction(productId: string) {
  try {
    await requireAdmin();
    const product = await productService.unpublish(productId);
    revalidateProductRoutes([product.slug]);
    return { ok: true, data: product } as const;
  } catch (error) {
    return failure(error);
  }
}

export async function hardDeleteProductAction(productId: string) {
  try {
    await requireAdmin();
    const product = await productService.hardDelete(productId);
    revalidateProductRoutes([product.slug]);
    return { ok: true, data: product } as const;
  } catch (error) {
    return failure(error);
  }
}
