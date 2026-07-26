import { describe, expect, it } from "vitest";
import { settingsSchema } from "../../src/lib/validation/settings";

const validSettings = {
  storeName: "  Toko Nikmat  ",
  logoBucket: "product-images",
  logoPath: "store/logo.webp",
  whatsappPhone: "6285712345678",
  originLabel: "  Kecamatan Coblong, Kota Bandung  ",
  originAddress: "  Jalan Sangkuriang No. 1  ",
  originRajaongkirId: "12345",
  originRajaongkirLevel: "district",
  businessTimezone: "Asia/Jakarta",
};

describe("settingsSchema", () => {
  it("accepts and normalizes complete store settings", () => {
    expect(settingsSchema.parse(validSettings)).toEqual({
      ...validSettings,
      storeName: "Toko Nikmat",
      originLabel: "Kecamatan Coblong, Kota Bandung",
      originAddress: "Jalan Sangkuriang No. 1",
    });
  });

  it.each([
    ["+62 857-1234-5678", "6285712345678"],
    ["0857 1234 5678", "6285712345678"],
    ["62-857-1234-5678", "6285712345678"],
  ])("normalizes WhatsApp phone %s", (input, expected) => {
    expect(settingsSchema.parse({ ...validSettings, whatsappPhone: input }).whatsappPhone).toBe(expected);
  });

  it("accepts absent logo metadata only when both values are absent", () => {
    expect(
      settingsSchema.safeParse({ ...validSettings, logoBucket: null, logoPath: null }).success,
    ).toBe(true);

    expect(
      settingsSchema.safeParse({ ...validSettings, logoBucket: "product-images", logoPath: null }).success,
    ).toBe(false);
    expect(
      settingsSchema.safeParse({ ...validSettings, logoBucket: null, logoPath: "store/logo.webp" }).success,
    ).toBe(false);
  });

  it.each([
    ["empty store name", { storeName: "   " }],
    ["oversized store name", { storeName: "a".repeat(121) }],
    ["invalid WhatsApp phone", { whatsappPhone: "abc" }],
    ["short WhatsApp phone", { whatsappPhone: "0812" }],
    ["excessively long raw WhatsApp phone", { whatsappPhone: `+62${" ".repeat(100)}85712345678` }],
    ["empty origin label", { originLabel: "   " }],
    ["oversized origin label", { originLabel: "a".repeat(256) }],
    ["empty origin address", { originAddress: "   " }],
    ["oversized origin address", { originAddress: "a".repeat(501) }],
    ["empty RajaOngkir origin ID", { originRajaongkirId: "   " }],
    ["unsupported RajaOngkir level", { originRajaongkirLevel: "city" }],
    ["unsupported timezone", { businessTimezone: "UTC" }],
  ])("rejects %s", (_case, override) => {
    expect(settingsSchema.safeParse({ ...validSettings, ...override }).success).toBe(false);
  });
});
