import { describe, expect, it } from "vitest";

import { calculateSubtotal, formatRupiah } from "../../src/lib/money";

describe("integer rupiah helpers", () => {
  it.each([
    [BigInt(0), "Rp0"],
    [BigInt(1), "Rp1"],
    [BigInt(1_000), "Rp1.000"],
    [BigInt(1_234_567), "Rp1.234.567"],
    [BigInt("9007199254740993"), "Rp9.007.199.254.740.993"],
  ])("formats %s rupiah exactly", (amount, expected) => {
    expect(formatRupiah(amount)).toBe(expected);
  });

  it("calculates subtotal with bigint multiplication and addition", () => {
    expect(
      calculateSubtotal([
        { unitPrice: BigInt(19_999), quantity: 3 },
        { unitPrice: BigInt(25_001), quantity: 2 },
      ]),
    ).toBe(BigInt(109_999));
  });

  it("preserves values beyond Number.MAX_SAFE_INTEGER without floating-point rounding", () => {
    expect(
      calculateSubtotal([
        { unitPrice: BigInt("9007199254740993"), quantity: 2 },
        { unitPrice: BigInt(1), quantity: 1 },
      ]),
    ).toBe(BigInt("18014398509481987"));
  });

  it("returns zero bigint for an empty subtotal", () => {
    expect(calculateSubtotal([])).toBe(BigInt(0));
  });

  it.each([0, -1, 1.5, 100])("rejects invalid quantity %s", (quantity) => {
    expect(() => calculateSubtotal([{ unitPrice: BigInt(1_000), quantity }])).toThrow();
  });

  it("rejects negative rupiah amounts", () => {
    expect(() => formatRupiah(BigInt(-1))).toThrow();
    expect(() => calculateSubtotal([{ unitPrice: BigInt(-1), quantity: 1 }])).toThrow();
  });
});
