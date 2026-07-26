"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCart } from "@/contexts/cart-context";
import { formatRupiah } from "@/lib/money";
import { MAX_CART_QUANTITY, type HydratedCartProduct } from "@/types/cart";

type CartItemRowProps = {
  product: HydratedCartProduct;
  quantity: number;
};

export function CartItemRow({ product, quantity }: CartItemRowProps) {
  const { changeQuantity, removeItem } = useCart();
  const isAvailable = product.isPublished && product.stock > 0;

  return (
    <article className="grid gap-4 border-b border-border py-6 sm:grid-cols-[1fr_auto] sm:items-center">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold text-foreground">{product.name}</h2>
        <p className="mt-1 font-semibold tabular-nums text-foreground">
          {formatRupiah(BigInt(product.priceRupiah))}
        </p>
        {!isAvailable && (
          <p className="mt-2 text-sm font-medium text-destructive">Produk tidak tersedia</p>
        )}
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <label className="grid gap-1 text-sm font-medium text-foreground">
          Jumlah
          <Input
            className="w-24 tabular-nums"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CART_QUANTITY}
            value={quantity}
            onChange={(event) => {
              const nextQuantity = event.currentTarget.valueAsNumber;
              if (
                Number.isInteger(nextQuantity) &&
                nextQuantity >= 1 &&
                nextQuantity <= MAX_CART_QUANTITY
              ) {
                changeQuantity(product.id, nextQuantity);
              }
            }}
          />
        </label>
        <Button variant="outline" onClick={() => removeItem(product.id)}>
          Hapus
        </Button>
      </div>
    </article>
  );
}
