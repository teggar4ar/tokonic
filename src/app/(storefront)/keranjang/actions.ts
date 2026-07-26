"use server";

import { z } from "zod";

import { getPublishedProductsForCart } from "@/server/data/products";

const cartProductIdsSchema = z.array(z.uuid()).max(99);

export async function loadCartProducts(productIds: string[]) {
  const parsed = cartProductIdsSchema.safeParse(productIds);

  if (!parsed.success) {
    return [];
  }

  return getPublishedProductsForCart([...new Set(parsed.data)]);
}
