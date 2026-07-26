import { z } from "zod";

const postgresIntegerMaximum = 2_147_483_647;

export const productSlugSchema = z.string().trim().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

const productFields = {
  name: z.string().trim().min(1).max(255),
  slug: productSlugSchema,
  description: z.string().trim(),
  price: z.number().int().min(0).max(Number.MAX_SAFE_INTEGER),
  stock: z.number().int().min(0).max(postgresIntegerMaximum),
  weightGrams: z.number().int().min(1).max(postgresIntegerMaximum),
  isPublished: z.boolean(),
};

export const productCreateSchema = z.strictObject(productFields);

export const productUpdateSchema = z.strictObject({
  id: z.uuid(),
  ...productFields,
});

export const productIdSchema = z.uuid();

export type ProductCreateInput = z.infer<typeof productCreateSchema>;
export type ProductUpdateInput = z.infer<typeof productUpdateSchema>;
