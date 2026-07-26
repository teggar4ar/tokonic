"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  addCartItem,
  changeCartItemQuantity,
  EMPTY_CART,
  readCartStorage,
  removeCartItem,
  writeCartStorage,
} from "@/lib/cart";
import type { CartState } from "@/types/cart";

type CartContextValue = {
  state: CartState;
  isHydrated: boolean;
  addItem: (productId: string, quantity?: number) => void;
  removeItem: (productId: string) => void;
  changeQuantity: (productId: string, quantity: number) => void;
};

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<CartState>(EMPTY_CART);
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (!cancelled) {
        setState(readCartStorage(window.localStorage));
        setIsHydrated(true);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isHydrated) {
      writeCartStorage(window.localStorage, state);
    }
  }, [isHydrated, state]);

  const addItem = useCallback((productId: string, quantity = 1) => {
    setState((current) => addCartItem(current, productId, quantity));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setState((current) => removeCartItem(current, productId));
  }, []);

  const changeQuantity = useCallback((productId: string, quantity: number) => {
    setState((current) => changeCartItemQuantity(current, productId, quantity));
  }, []);

  const value = useMemo(
    () => ({ state, isHydrated, addItem, removeItem, changeQuantity }),
    [state, isHydrated, addItem, removeItem, changeQuantity],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);

  if (!context) {
    throw new Error("useCart harus digunakan di dalam CartProvider");
  }

  return context;
}
