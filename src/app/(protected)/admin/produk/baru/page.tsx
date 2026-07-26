import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { ProductForm } from "@/components/forms/product-form";

export const metadata = {
  title: "Tambah Produk — Tokonic Admin",
};

export default function AdminNewProductPage() {
  return (
    <main className="px-gutter py-8">
      <AdminPageHeader
        title="Tambah produk"
        description="Lengkapi informasi produk. Gambar bisa ditambahkan setelah produk tersimpan."
      />
      <div className="mt-6 max-w-2xl">
        <ProductForm mode="create" />
      </div>
    </main>
  );
}
