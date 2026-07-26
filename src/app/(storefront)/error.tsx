"use client";

import { Button } from "@/components/ui/button";

export default function StorefrontError({ reset }: { reset: () => void }) {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-16 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-semibold text-foreground">Katalog belum berhasil dimuat</h1>
      <p className="mt-2 max-w-xl leading-7 text-muted-foreground">
        Terjadi gangguan saat memuat data toko. Coba lagi.
      </p>
      <Button className="mt-6" onClick={reset}>
        Coba lagi
      </Button>
    </main>
  );
}
