import type { Metadata } from "next";

import { CartView } from "@/components/cart/cart-view";
export const metadata: Metadata = {
  title: "Keranjang | Tokonic",
};

export default function CartPage() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="border-b border-border pb-6">
        <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">Keranjang</h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Periksa jumlah produk sebelum melanjutkan ke checkout.
        </p>
      </header>
      <CartView />
    </main>
  );
}
