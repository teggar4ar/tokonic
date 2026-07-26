import { z } from "zod";

export const productImageBucket = "product-images" as const;
export const productImageMaximumBytes = 2 * 1024 * 1024;
export const productImageMaximumCount = 5;

export const productImageMimeSchema = z.enum(["image/jpeg", "image/png", "image/webp"]);
export const productImagePathSchema = z.string().regex(/^products\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.(?:jpg|png|webp)$/i);
const dimensionSchema = z.number().int().min(1).max(32_767);

export const productImageMetadataSchema = z.strictObject({
  productId: z.uuid(),
  objectPath: productImagePathSchema,
  mimeType: productImageMimeSchema,
  byteSize: z.number().int().min(1).max(productImageMaximumBytes),
  width: dimensionSchema,
  height: dimensionSchema,
  displayOrder: z.number().int().min(0).max(4),
});

export const productImageReplacementSchema = z.object({
  imageId: z.uuid(),
  objectPath: productImagePathSchema,
  mimeType: productImageMimeSchema,
  byteSize: z.number().int().min(1).max(productImageMaximumBytes),
  width: dimensionSchema,
  height: dimensionSchema,
});

export const productImageIdSchema = z.uuid();
export type ProductImageMetadataInput = z.infer<typeof productImageMetadataSchema>;
export type ProductImageReplacementInput = z.infer<typeof productImageReplacementSchema>;
