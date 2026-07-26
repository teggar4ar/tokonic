import { cartItemSchema, cartStateSchema } from "./validation/cart";
import {
  CART_STORAGE_KEY,
  CART_VERSION,
  MAX_CART_QUANTITY,
  type CartItem,
  type CartState,
} from "../types/cart";

export const EMPTY_CART: CartState = { version: CART_VERSION, items: [] };

function sanitizeItems(items: unknown[]) {
  const merged = new Map<string, number>();

  for (const item of items) {
    const parsed = cartItemSchema.safeParse(item);

    if (!parsed.success) {
      continue;
    }

    const current = merged.get(parsed.data.productId) ?? 0;
    merged.set(
      parsed.data.productId,
      Math.min(MAX_CART_QUANTITY, current + parsed.data.quantity),
    );
  }

  return Array.from(merged, ([productId, quantity]) => ({ productId, quantity }));
}

export function parseCartStorage(stored: string | null): CartState {
  if (stored === null) {
    return EMPTY_CART;
  }

  try {
    const parsed = cartStateSchema.safeParse(JSON.parse(stored));

    if (!parsed.success) {
      return EMPTY_CART;
    }

    return { version: CART_VERSION, items: sanitizeItems(parsed.data.items) };
  } catch {
    return EMPTY_CART;
  }
}

export function serializeCartState(state: CartState) {
  return JSON.stringify({
    version: CART_VERSION,
    items: state.items.map(({ productId, quantity }) => ({ productId, quantity })),
  });
}

type CartReadableStorage = Pick<Storage, "getItem">;
type CartWritableStorage = Pick<Storage, "setItem">;

export function readCartStorage(storage: CartReadableStorage) {
  try {
    return parseCartStorage(storage.getItem(CART_STORAGE_KEY));
  } catch {
    return EMPTY_CART;
  }
}

export function writeCartStorage(storage: CartWritableStorage, state: CartState) {
  try {
    storage.setItem(CART_STORAGE_KEY, serializeCartState(state));
  } catch {
    return;
  }
}

export function addCartItem(
  state: CartState,
  productId: string,
  quantity = 1,
): CartState {
  const parsed = cartItemSchema.parse({ productId, quantity });
  const existing = state.items.find((item) => item.productId === parsed.productId);

  if (!existing) {
    return { ...state, items: [...state.items, parsed] };
  }

  return changeCartItemQuantity(
    state,
    parsed.productId,
    Math.min(MAX_CART_QUANTITY, existing.quantity + parsed.quantity),
  );
}

export function removeCartItem(state: CartState, productId: string): CartState {
  return {
    ...state,
    items: state.items.filter((item) => item.productId !== productId),
  };
}

export function changeCartItemQuantity(
  state: CartState,
  productId: string,
  quantity: number,
): CartState {
  if (quantity === 0) {
    return removeCartItem(state, productId);
  }

  const parsed: CartItem = cartItemSchema.parse({ productId, quantity });

  return {
    ...state,
    items: state.items.map((item) =>
      item.productId === parsed.productId ? parsed : item,
    ),
  };
}
