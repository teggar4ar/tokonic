import { describe, expect, it } from "vitest";
import { productCreateSchema, productUpdateSchema } from "../../src/lib/validation/products";

const validProduct = {
  name: "Kopi Tokonic",
  slug: "kopi-tokonic",
  description: "Kopi sintetis untuk pengujian.",
  price: 25_000,
  stock: 10,
  weightGrams: 250,
  isPublished: false,
};

describe("product validation", () => {
  it("accepts bounded integer product values", () => {
    expect(productCreateSchema.safeParse(validProduct).success).toBe(true);
  });

  it.each([
    ["price", -1],
    ["price", 1.5],
    ["price", Number.MAX_SAFE_INTEGER + 1],
    ["stock", -1],
    ["stock", 1.5],
    ["stock", 2_147_483_648],
    ["weightGrams", 0],
    ["weightGrams", 1.5],
    ["weightGrams", 2_147_483_648],
  ])("rejects unsafe or out-of-database-range %s values", (field, value) => {
    expect(productCreateSchema.safeParse({ ...validProduct, [field]: value }).success).toBe(false);
  });

  it("requires a valid product id for updates", () => {
    expect(productUpdateSchema.safeParse({ ...validProduct, id: "not-a-uuid" }).success).toBe(false);
    expect(productUpdateSchema.safeParse({ ...validProduct, id: "10000000-0000-4000-8000-000000000001" }).success).toBe(true);
  });
});
