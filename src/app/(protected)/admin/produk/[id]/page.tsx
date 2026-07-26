import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/forms/product-form";
import { ProductImageManager } from "@/components/forms/product-image-manager";
import { productIdSchema } from "@/lib/validation/products";
import { AppError } from "@/server/errors/app-error";
import { getOwnedProduct, listOwnedProductImages } from "@/server/data/products";

export const metadata = {
  title: "Ubah Produk — Tokonic Admin",
};

type AdminEditProductPageProps = { params: Promise<{ id: string }> };

export default async function AdminEditProductPage({ params }: AdminEditProductPageProps) {
  const { id } = await params;
  const parsedId = productIdSchema.safeParse(id);

  if (!parsedId.success) {
    notFound();
  }

  let product;
  let images;
  try {
    [product, images] = await Promise.all([
      getOwnedProduct(parsedId.data),
      listOwnedProductImages(parsedId.data),
    ]);
  } catch (error) {
    if (error instanceof AppError && error.code === "NOT_FOUND") {
      notFound();
    }
    throw error;
  }

  return (
    <main className="px-gutter py-8">
      <AdminPageHeader
        title="Ubah produk"
        description={product.name}
      />
      <div className="mt-6 grid max-w-2xl gap-10">
        <section aria-labelledby="product-images-heading" className="grid gap-4 border-b border-border pb-10">
          <h2 id="product-images-heading" className="text-lg font-semibold">
            Gambar produk
          </h2>
          <ProductImageManager productId={product.id} images={images} />
        </section>
        <ProductForm mode="edit" product={product} />
      </div>
    </main>
  );
}
