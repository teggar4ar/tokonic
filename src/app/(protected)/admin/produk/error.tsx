"use client";

import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/reui/alert";
import { Button } from "@/components/ui/button";

export default function AdminProductsError({ reset }: { reset: () => void }) {
  return (
    <main className="px-gutter py-8">
      <header className="border-b border-border pb-6">
        <h1 className="text-2xl font-bold leading-[1.2] sm:text-[1.75rem]">Produk</h1>
      </header>
      <div className="mt-6 max-w-2xl">
        <Alert variant="destructive">
          <ExclamationTriangleIcon aria-hidden="true" />
          <AlertTitle>Daftar produk belum berhasil dimuat.</AlertTitle>
          <AlertDescription>Periksa koneksi lalu muat ulang halaman ini.</AlertDescription>
          <AlertAction>
            <Button variant="outline" size="sm" onClick={reset}>
              Coba lagi
            </Button>
          </AlertAction>
        </Alert>
      </div>
    </main>
  );
}
