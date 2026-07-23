import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { logout } from "@/actions/auth";
import { Button } from "@/components/ui/button";
import { getCurrentSeller } from "@/server/data/seller";

export default async function AdminPage() {
  const seller = await getCurrentSeller();

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">Admin Tokonic</p>
          <h1 className="text-2xl font-semibold">{seller.store_name}</h1>
        </div>
        <form action={logout}>
          <Button type="submit" variant="outline">
            <ArrowRightStartOnRectangleIcon className="size-4" aria-hidden="true" />
            Keluar
          </Button>
        </form>
      </header>
      <section className="rounded-xl border bg-card p-6">
        <h2 className="font-medium">Foundation siap</h2>
        <p className="mt-2 text-sm text-muted-foreground">Katalog dan pengelolaan produk akan ditambahkan pada Phase 2.</p>
      </section>
    </main>
  );
}
