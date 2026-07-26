import Link from "next/link";
import { ArrowRightIcon } from "@heroicons/react/24/outline";
import { AdminPageHeader } from "@/components/admin/admin-page-header";
import { getCurrentSeller } from "@/server/data/seller";

export default async function AdminPage() {
  const seller = await getCurrentSeller();

  return (
    <main className="px-gutter py-8">
      <AdminPageHeader
        title={seller.store_name}
        description="Ringkasan operasional toko akan tampil di sini setelah katalog dan pesanan tersedia."
      />
      <section className="mt-6 max-w-prose">
        <h2 className="text-lg font-semibold">Mulai dari pengaturan toko</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Lengkapi identitas toko dan asal pengiriman agar perhitungan ongkos kirim siap dipakai saat katalog dibuka.
        </p>
        <Link
          href="/admin/pengaturan"
          className="mt-4 inline-flex h-control items-center gap-2 rounded-md bg-accent px-4 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent-hover"
        >
          Buka pengaturan toko
          <ArrowRightIcon className="size-4" aria-hidden="true" />
        </Link>
      </section>
    </main>
  );
}
