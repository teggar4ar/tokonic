import { formatRupiah } from "@/lib/money";

export function CartSummary({ subtotal }: { subtotal: bigint }) {
  return (
    <aside className="border-t border-border pt-6 lg:border-t-0 lg:border-l lg:pl-8 lg:pt-0">
      <h2 className="text-xl font-semibold text-foreground">Ringkasan</h2>
      <div className="mt-4 flex items-center justify-between gap-4">
        <span className="text-muted-foreground">Subtotal</span>
        <strong className="tabular-nums text-foreground">{formatRupiah(subtotal)}</strong>
      </div>
      <p className="mt-3 text-sm leading-6 text-muted-foreground">
        Harga dan ketersediaan akan diperiksa kembali saat checkout.
      </p>
    </aside>
  );
}
