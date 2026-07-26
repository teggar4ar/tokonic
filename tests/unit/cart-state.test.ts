import { describe, expect, it } from "vitest";

import {
  addCartItem,
  changeCartItemQuantity,
  parseCartStorage,
  readCartStorage,
  removeCartItem,
  serializeCartState,
  writeCartStorage,
} from "../../src/lib/cart";

const PRODUCT_A = "11111111-1111-4111-8111-111111111111";
const PRODUCT_B = "22222222-2222-4222-8222-222222222222";
const PRODUCT_C = "33333333-3333-4333-8333-333333333333";

const emptyCart = { version: 1 as const, items: [] };

describe("tokonic_cart_v1 state", () => {
  it("recovers from malformed JSON with an empty current-version cart", () => {
    expect(parseCartStorage("{not-json")).toEqual(emptyCart);
  });

  it.each([
    JSON.stringify({ version: 0, items: [{ productId: PRODUCT_A, quantity: 1 }] }),
    JSON.stringify({ version: 2, items: [{ productId: PRODUCT_A, quantity: 1 }] }),
    JSON.stringify({ items: [{ productId: PRODUCT_A, quantity: 1 }] }),
  ])("rejects an unsupported or missing version", (stored) => {
    expect(parseCartStorage(stored)).toEqual(emptyCart);
  });

  it("removes malformed entries while preserving valid IDs and quantities", () => {
    const stored = JSON.stringify({
      version: 1,
      items: [
        { productId: PRODUCT_A, quantity: 2 },
        { productId: "not-a-uuid", quantity: 1 },
        { productId: PRODUCT_B, quantity: 0 },
        { productId: PRODUCT_B, quantity: -1 },
        { productId: PRODUCT_B, quantity: 1.5 },
        { productId: PRODUCT_B, quantity: "2" },
        { productId: PRODUCT_C },
        null,
      ],
    });

    expect(parseCartStorage(stored)).toEqual({
      version: 1,
      items: [{ productId: PRODUCT_A, quantity: 2 }],
    });
  });

  it("merges duplicate UUID products and caps their combined quantity", () => {
    const stored = JSON.stringify({
      version: 1,
      items: [
        { productId: PRODUCT_A, quantity: 40 },
        { productId: PRODUCT_B, quantity: 3 },
        { productId: PRODUCT_A, quantity: 70 },
      ],
    });

    expect(parseCartStorage(stored)).toEqual({
      version: 1,
      items: [
        { productId: PRODUCT_A, quantity: 99 },
        { productId: PRODUCT_B, quantity: 3 },
      ],
    });
  });

  it("accepts only positive integer quantities bounded at 99", () => {
    const stored = JSON.stringify({
      version: 1,
      items: [
        { productId: PRODUCT_A, quantity: 1 },
        { productId: PRODUCT_B, quantity: 99 },
        { productId: PRODUCT_C, quantity: 100 },
      ],
    });

    expect(parseCartStorage(stored)).toEqual({
      version: 1,
      items: [
        { productId: PRODUCT_A, quantity: 1 },
        { productId: PRODUCT_B, quantity: 99 },
      ],
    });
  });

  it("adds a new product and merges repeated additions without exceeding the cap", () => {
    const withProduct = addCartItem(emptyCart, PRODUCT_A, 60);

    expect(addCartItem(withProduct, PRODUCT_A, 50)).toEqual({
      version: 1,
      items: [{ productId: PRODUCT_A, quantity: 99 }],
    });
  });

  it("removes a product without changing the remaining order", () => {
    const state = {
      version: 1 as const,
      items: [
        { productId: PRODUCT_A, quantity: 1 },
        { productId: PRODUCT_B, quantity: 2 },
      ],
    };

    expect(removeCartItem(state, PRODUCT_A)).toEqual({
      version: 1,
      items: [{ productId: PRODUCT_B, quantity: 2 }],
    });
  });

  it("changes quantity and removes the product when changed to zero", () => {
    const state = {
      version: 1 as const,
      items: [{ productId: PRODUCT_A, quantity: 2 }],
    };

    expect(changeCartItemQuantity(state, PRODUCT_A, 8)).toEqual({
      version: 1,
      items: [{ productId: PRODUCT_A, quantity: 8 }],
    });
    expect(changeCartItemQuantity(state, PRODUCT_A, 0)).toEqual(emptyCart);
  });

  it("serializes only the version, product IDs, and quantities for refresh persistence", () => {
    const state = {
      version: 1 as const,
      items: [{ productId: PRODUCT_A, quantity: 2 }],
    };

    const serialized = serializeCartState(state);

    expect(JSON.parse(serialized)).toEqual(state);
    expect(parseCartStorage(serialized)).toEqual(state);
    expect(serialized).not.toContain("price");
    expect(serialized).not.toContain("name");
    expect(serialized).not.toContain("image");
  });

  it("recovers with an empty cart when storage cannot be read", () => {
    const storage = {
      getItem() {
        throw new Error("blocked");
      },
    };

    expect(readCartStorage(storage)).toEqual(emptyCart);
  });

  it("does not throw when storage cannot be written", () => {
    const storage = {
      setItem() {
        throw new Error("quota exceeded");
      },
    };

    expect(() => writeCartStorage(storage, emptyCart)).not.toThrow();
  });
});
