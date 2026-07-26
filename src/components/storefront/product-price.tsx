import { formatRupiah } from "@/lib/money";

export function ProductPrice({ priceRupiah, className }: { priceRupiah: string; className?: string }) {
  return (
    <span className={`font-semibold tabular-nums text-foreground ${className ?? ""}`.trim()}>
      {formatRupiah(BigInt(priceRupiah))}
    </span>
  );
}
