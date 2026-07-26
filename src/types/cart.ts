export const CART_STORAGE_KEY = "tokonic_cart_v1";
export const CART_VERSION = 1 as const;
export const MAX_CART_QUANTITY = 99;

export type CartItem = {
  productId: string;
  quantity: number;
};

export type CartState = {
  version: typeof CART_VERSION;
  items: CartItem[];
};

export type HydratedCartProduct = {
  id: string;
  name: string;
  priceRupiah: string;
  imageUrl?: string;
  isPublished: boolean;
  stock: number;
};
