import Link from "next/link";
import { PhotoIcon } from "@heroicons/react/24/outline";

import { ProductPrice } from "@/components/storefront/product-price";
import { StockIndicator } from "@/components/storefront/stock-indicator";
import { publicProductImageUrl } from "@/lib/storage-url";

export type CatalogProduct = {
  id: string;
  slug: string;
  name: string;
  priceRupiah: string;
  stock: number;
  primaryImagePath: string | null;
};

export function ProductCard({ product, aboveFold = false }: { product: CatalogProduct; aboveFold?: boolean }) {
  const isAvailable = product.stock > 0;

  return (
    <Link
      href={`/produk/${product.slug}`}
      className="group block rounded-xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-muted">
        {product.primaryImagePath ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={publicProductImageUrl(product.primaryImagePath)}
            alt={product.name}
            width={640}
            height={640}
            loading={aboveFold ? "eager" : "lazy"}
            className={`size-full object-cover transition-transform duration-200 group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100 ${isAvailable ? "" : "opacity-60 grayscale"}`.trim()}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <PhotoIcon aria-hidden="true" className="size-10 text-muted-foreground/60" />
          </div>
        )}
        {!isAvailable && (
          <span className="absolute left-2 top-2 rounded-md bg-foreground/80 px-2 py-1 text-xs font-medium text-background">
            Stok habis
          </span>
        )}
      </div>
      <div className="mt-3 space-y-1">
        <h3 className="line-clamp-2 font-medium leading-snug text-foreground">{product.name}</h3>
        <ProductPrice priceRupiah={product.priceRupiah} className="block text-lg" />
        <StockIndicator stock={product.stock} />
      </div>
    </Link>
  );
}
