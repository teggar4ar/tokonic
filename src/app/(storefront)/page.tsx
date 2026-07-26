import type { Metadata } from "next";

import { ProductCard } from "@/components/storefront/product-card";
import { listPublishedProducts } from "@/server/data/products";
import { getPublicStoreProfile } from "@/server/data/seller";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const profile = await getPublicStoreProfile();
  const storeName = profile?.storeName ?? "Tokonic";

  return {
    title: storeName,
    description: `Katalog produk ${storeName}`,
  };
}

export default async function CatalogPage() {
  const [profile, products] = await Promise.all([
    getPublicStoreProfile(),
    listPublishedProducts(),
  ]);
  const storeName = profile?.storeName ?? "Tokonic";

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <header className="pb-8">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
          {storeName}
        </h1>
        <p className="mt-2 max-w-2xl leading-7 text-muted-foreground">
          Pilih produk, lalu lanjutkan ke keranjang untuk memesan.
        </p>
      </header>
      {products.length === 0 ? (
        <div className="border-t border-border py-16">
          <h2 className="text-xl font-semibold text-foreground">Belum ada produk</h2>
          <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
            Katalog sedang disiapkan. Silakan kunjungi kembali beberapa saat lagi.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
          {products.map((product, index) => (
            <li key={product.id}>
              <ProductCard product={product} aboveFold={index < 4} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
