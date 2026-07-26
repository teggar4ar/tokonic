import Link from "next/link";

import { buttonVariants } from "@/components/ui/button";

export default function AdminNotFound() {
  return (
    <main className="px-gutter py-8">
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold leading-tight sm:text-3xl">Halaman tidak ditemukan</h1>
      </header>
      <div className="mt-6 max-w-2xl">
        <p className="leading-7 text-muted-foreground">
          Data yang kamu buka tidak tersedia atau sudah dihapus. Kembali ke daftar produk untuk melanjutkan.
        </p>
        <Link href="/admin/produk" className={buttonVariants({ variant: "outline", className: "mt-6" })}>
          Kembali ke daftar produk
        </Link>
      </div>
    </main>
  );
}
