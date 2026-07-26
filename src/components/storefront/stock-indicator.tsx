export function StockIndicator({ stock }: { stock: number }) {
  if (stock <= 0) {
    return <p className="text-sm font-medium text-destructive">Stok habis</p>;
  }

  if (stock <= 5) {
    return <p className="text-sm font-medium text-warning">Tersisa {stock}</p>;
  }

  return <p className="text-sm text-muted-foreground">Stok tersedia</p>;
}
