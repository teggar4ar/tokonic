import { describe, expect, it } from "vitest";

import { buildWhatsAppProductUrl } from "../../src/lib/whatsapp";

describe("buildWhatsAppProductUrl", () => {
  it("targets wa.me with the configured seller number", () => {
    const url = buildWhatsAppProductUrl({
      whatsappPhone: "6285712345678",
      productName: "Kopi Tokonic",
      productSlug: "kopi-tokonic",
    });

    expect(url).not.toBeNull();
    const parsed = new URL(url!);
    expect(parsed.origin).toBe("https://wa.me");
    expect(parsed.pathname).toBe("/6285712345678");
  });

  it("includes only safely encoded product context in the text parameter", () => {
    const url = buildWhatsAppProductUrl({
      whatsappPhone: "6285712345678",
      productName: 'Kopi "Spesial" & Teh <Premium>',
      productSlug: "kopi-spesial-teh-premium",
    });

    const parsed = new URL(url!);
    const text = parsed.searchParams.get("text");
    expect(text).toContain('Kopi "Spesial" & Teh <Premium>');
    expect(text).toContain("/produk/kopi-spesial-teh-premium");
    expect(url).not.toContain(" ");
    expect(url).not.toContain('"');
    expect(url).not.toContain("<");
  });

  it("adds no query parameters beyond the text context", () => {
    const url = buildWhatsAppProductUrl({
      whatsappPhone: "6285712345678",
      productName: "Kopi Tokonic",
      productSlug: "kopi-tokonic",
    });

    const parsed = new URL(url!);
    expect([...parsed.searchParams.keys()]).toEqual(["text"]);
  });

  it.each([
    ["letters", "abc"],
    ["leading zero", "085712345678"],
    ["plus prefix", "+6285712345678"],
    ["too short", "628571"],
    ["too long", "6285712345678901234"],
    ["empty", ""],
  ])("returns null for an invalid phone (%s)", (_label, whatsappPhone) => {
    const url = buildWhatsAppProductUrl({
      whatsappPhone,
      productName: "Kopi Tokonic",
      productSlug: "kopi-tokonic",
    });

    expect(url).toBeNull();
  });

  it("returns null for an invalid product slug", () => {
    const url = buildWhatsAppProductUrl({
      whatsappPhone: "6285712345678",
      productName: "Kopi Tokonic",
      productSlug: "../pesanan/123",
    });

    expect(url).toBeNull();
  });
});
