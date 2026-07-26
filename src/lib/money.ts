import { MAX_CART_QUANTITY } from "../types/cart";

type SubtotalItem = {
  unitPrice: bigint;
  quantity: number;
};

function assertRupiah(amount: bigint) {
  if (amount < BigInt(0)) {
    throw new RangeError("Nilai rupiah tidak boleh negatif");
  }
}

function assertQuantity(quantity: number) {
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_CART_QUANTITY) {
    throw new RangeError("Jumlah produk harus antara 1 dan 99");
  }
}

export function formatRupiah(amount: bigint) {
  assertRupiah(amount);

  const digits = amount.toString();
  const groups: string[] = [];

  for (let end = digits.length; end > 0; end -= 3) {
    groups.unshift(digits.slice(Math.max(0, end - 3), end));
  }

  return `Rp${groups.join(".")}`;
}

export function calculateSubtotal(items: readonly SubtotalItem[]) {
  return items.reduce((subtotal, item) => {
    assertRupiah(item.unitPrice);
    assertQuantity(item.quantity);
    return subtotal + item.unitPrice * BigInt(item.quantity);
  }, BigInt(0));
}
