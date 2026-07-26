import { z } from "zod";

import { CART_VERSION, MAX_CART_QUANTITY } from "../../types/cart";

export const cartItemSchema = z.object({
  productId: z.uuid(),
  quantity: z.number().int().min(1).max(MAX_CART_QUANTITY),
});

export const cartStateSchema = z.object({
  version: z.literal(CART_VERSION),
  items: z.array(z.unknown()),
});
