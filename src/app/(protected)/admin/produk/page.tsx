import Link from "next/link";
import { PlusIcon } from "@heroicons/react/24/outline";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { AdminProductList } from "@/components/admin/product-list";
import { buttonVariants } from "@/components/ui/button";
import { listOwnedProducts } from "@/server/data/products";

export const metadata = {
  title: "Produk — Tokonic Admin",
};

export default async function AdminProductsPage() {
  const products = await listOwnedProducts();
  const publishedCount = products.filter((product) => product.isPublished).length;

  return (
    <main className="px-gutter py-8">
      <AdminPageHeader
        title="Produk"
        description={
          products.length === 0
            ? "Kelola katalog produk toko dari satu tempat."
            : `${products.length} produk terdaftar, ${publishedCount} tayang di katalog.`
        }
        action={
          <Link href="/admin/produk/baru" className={buttonVariants({ variant: "accent" })}>
            <PlusIcon className="size-5" aria-hidden="true" />
            Tambah produk
          </Link>
        }
      />
      <div className="mt-6">
        <AdminProductList products={products} />
      </div>
    </main>
  );
}
