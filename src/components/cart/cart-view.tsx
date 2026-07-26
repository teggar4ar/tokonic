"use client";

import { useEffect, useState } from "react";

import { loadCartProducts } from "@/app/(storefront)/keranjang/actions";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { CartSummary } from "@/components/cart/cart-summary";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/cart-context";
import { calculateSubtotal } from "@/lib/money";
import type { HydratedCartProduct } from "@/types/cart";

export function CartView() {
  const { state, isHydrated } = useCart();
  const [products, setProducts] = useState<HydratedCartProduct[]>([]);
  const [loadedProductIdsKey, setLoadedProductIdsKey] = useState("");
  const [loadFailed, setLoadFailed] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const productIds = state.items.map((item) => item.productId);
  const productIdsKey = productIds.join(",");

  useEffect(() => {
    let cancelled = false;

    if (!isHydrated || productIdsKey.length === 0) {
      return;
    }

    loadCartProducts(productIdsKey.split(","))
      .then((currentProducts) => {
        if (!cancelled) {
          setProducts(currentProducts);
          setLoadedProductIdsKey(productIdsKey);
          setLoadFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadFailed(true);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [isHydrated, productIdsKey, loadAttempt]);

  const productsById = new Map(products.map((product) => [product.id, product]));
  const hydratedItems = state.items.flatMap((item) => {
    const product = productsById.get(item.productId);
    return product ? [{ ...item, product }] : [];
  });
  const subtotal = calculateSubtotal(
    hydratedItems.map(({ product, quantity }) => ({
      unitPrice: BigInt(product.priceRupiah),
      quantity,
    })),
  );

  if (loadFailed) {
    return (
      <div role="alert" className="py-12">
        <h2 className="text-xl font-semibold text-foreground">Keranjang belum berhasil dimuat</h2>
        <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
          Terjadi gangguan saat memuat data produk. Coba lagi.
        </p>
        <Button
          className="mt-6"
          onClick={() => {
            setLoadFailed(false);
            setLoadAttempt((attempt) => attempt + 1);
          }}
        >
          Coba lagi
        </Button>
      </div>
    );
  }

  if (!isHydrated || (productIds.length > 0 && loadedProductIdsKey !== productIdsKey)) {
    return (
      <p role="status" className="py-12 text-muted-foreground">
        Memuat keranjang...
      </p>
    );
  }

  if (state.items.length === 0) {
    return (
      <div className="py-12">
        <h2 className="text-xl font-semibold text-foreground">Keranjang masih kosong</h2>
        <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
          Tambahkan produk dari katalog untuk mulai berbelanja.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section aria-label="Produk dalam keranjang">
        {hydratedItems.map(({ product, quantity }) => (
          <CartItemRow key={product.id} product={product} quantity={quantity} />
        ))}
        {hydratedItems.length < state.items.length && (
          <p role="alert" className="py-4 text-sm text-destructive">
            Sebagian produk tidak lagi tersedia dan tidak dihitung dalam subtotal.
          </p>
        )}
      </section>
      <CartSummary subtotal={subtotal} />
    </div>
  );
}
