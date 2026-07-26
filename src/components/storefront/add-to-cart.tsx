"use client";

import { useEffect, useRef, useState } from "react";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";

import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldDecrement,
  NumberFieldGroup,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/reui/number-field";
import { useCart } from "@/contexts/cart-context";
import { MAX_CART_QUANTITY } from "@/types/cart";

type AddToCartProps = {
  productId: string;
  stock: number;
};

export function AddToCart({ productId, stock }: AddToCartProps) {
  const { addItem, isHydrated } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxQuantity = Math.min(Math.max(stock, 1), MAX_CART_QUANTITY);
  const isAvailable = stock > 0;

  useEffect(() => {
    return () => {
      if (resetTimer.current !== null) {
        clearTimeout(resetTimer.current);
      }
    };
  }, []);

  if (!isAvailable) {
    return (
      <p className="text-sm font-medium text-destructive" role="status">
        Produk sedang tidak tersedia dan belum bisa ditambahkan ke keranjang.
      </p>
    );
  }

  return (
    <div className="grid gap-3">
      <NumberField
        id="jumlah-produk"
        value={quantity}
        min={1}
        max={maxQuantity}
        disabled={!isHydrated}
        onValueChange={(value) => {
          if (value !== null && Number.isInteger(value)) {
            setQuantity(Math.min(maxQuantity, Math.max(1, value)));
          }
        }}
        className="max-w-40"
      >
        <Label htmlFor="jumlah-produk">Jumlah</Label>
        <NumberFieldGroup className="h-control">
          <NumberFieldDecrement aria-label="Kurangi jumlah" />
          <NumberFieldInput inputMode="numeric" />
          <NumberFieldIncrement aria-label="Tambah jumlah" />
        </NumberFieldGroup>
      </NumberField>
      <Button
        variant="accent"
        size="control"
        disabled={!isHydrated}
        className="w-full sm:w-auto sm:min-w-56"
        onClick={() => {
          addItem(productId, quantity);
          setJustAdded(true);
          if (resetTimer.current !== null) {
            clearTimeout(resetTimer.current);
          }
          resetTimer.current = setTimeout(() => setJustAdded(false), 2500);
        }}
      >
        <ShoppingCartIcon aria-hidden="true" className="size-5" />
        Tambah ke keranjang
      </Button>
      <p role="status" aria-live="polite" className="text-sm font-medium text-success">
        {justAdded ? "Produk ditambahkan ke keranjang." : "\u00A0"}
      </p>
    </div>
  );
}
