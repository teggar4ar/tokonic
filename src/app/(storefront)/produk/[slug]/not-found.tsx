import Link from "next/link";

export default function ProductNotFound() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Produk tidak ditemukan</h1>
      <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
        Produk yang kamu cari tidak tersedia atau sudah tidak dijual. Lihat produk lain di katalog.
      </p>
      <Link
        href="/"
        className="mt-6 inline-flex h-control items-center rounded-lg bg-accent px-4 text-sm font-medium text-white transition-colors hover:bg-accent-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        Kembali ke katalog
      </Link>
    </main>
  );
}
