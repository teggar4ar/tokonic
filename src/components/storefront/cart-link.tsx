"use client";

import Link from "next/link";
import { ShoppingCartIcon } from "@heroicons/react/24/outline";

import { useCart } from "@/contexts/cart-context";

export function CartLink() {
  const { state, isHydrated } = useCart();
  const itemCount = state.items.reduce((total, item) => total + item.quantity, 0);

  return (
    <Link
      href="/keranjang"
      className="relative inline-flex size-control items-center justify-center rounded-lg text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      aria-label={isHydrated && itemCount > 0 ? `Keranjang, ${itemCount} produk` : "Keranjang"}
    >
      <ShoppingCartIcon aria-hidden="true" className="size-6" />
      {isHydrated && itemCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 flex min-w-5 items-center justify-center rounded-full bg-accent px-1 text-xs font-semibold tabular-nums text-accent-foreground"
        >
          {itemCount > 99 ? "99+" : itemCount}
        </span>
      )}
    </Link>
  );
}
