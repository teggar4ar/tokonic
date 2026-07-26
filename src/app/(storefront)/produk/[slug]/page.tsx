import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddToCart } from "@/components/storefront/add-to-cart";
import { ProductGallery } from "@/components/storefront/product-gallery";
import { ProductPrice } from "@/components/storefront/product-price";
import { StockIndicator } from "@/components/storefront/stock-indicator";
import { WhatsAppProductLink } from "@/components/storefront/whatsapp-product-link";
import { getPublishedProductBySlug } from "@/server/data/products";
import { getPublicStoreContact, getPublicStoreProfile } from "@/server/data/seller";

export const dynamic = "force-dynamic";

type ProductDetailPageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const [product, profile] = await Promise.all([
    getPublishedProductBySlug(slug),
    getPublicStoreProfile(),
  ]);

  if (!product) {
    return { title: profile?.storeName ?? "Tokonic" };
  }

  return {
    title: `${product.name} | ${profile?.storeName ?? "Tokonic"}`,
    description: product.description.slice(0, 160) || `Detail produk ${product.name}`,
  };
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const [product, contact] = await Promise.all([
    getPublishedProductBySlug(slug),
    getPublicStoreContact(),
  ]);

  if (!product) {
    notFound();
  }

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <nav aria-label="Navigasi kembali" className="pb-6">
        <Link
          href="/"
          className="rounded-md text-sm font-medium text-accent hover:text-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          &larr; Kembali ke katalog
        </Link>
      </nav>
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <ProductGallery productName={product.name} imagePaths={product.imagePaths} />
        <div className="grid content-start gap-6">
          <header>
            <h1 className="text-[28px] font-bold leading-tight tracking-tight text-foreground sm:text-4xl">
              {product.name}
            </h1>
            <ProductPrice priceRupiah={product.priceRupiah} className="mt-3 block text-2xl" />
            <div className="mt-2">
              <StockIndicator stock={product.stock} />
            </div>
          </header>
          <AddToCart productId={product.id} stock={product.stock} />
          <WhatsAppProductLink
            whatsappPhone={contact?.whatsappPhone ?? null}
            productName={product.name}
            productSlug={product.slug}
          />
          {product.description.length > 0 && (
            <section aria-labelledby="product-description-heading" className="border-t border-border pt-6">
              <h2 id="product-description-heading" className="text-lg font-semibold text-foreground">
                Deskripsi produk
              </h2>
              <p className="mt-3 max-w-prose whitespace-pre-line leading-7 text-muted-foreground">
                {product.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}
