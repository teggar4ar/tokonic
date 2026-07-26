import { describe, expect, it } from "vitest";
import { storageImageFixtures, createOversizedImageFixture } from "../fixtures/storage-images";
import {
  buildProductImagePath,
  validateDecodedProductImage,
} from "../../src/lib/image";

const productId = "30000000-0000-4000-8000-000000000003";
const imageId = "60000000-0000-4000-8000-000000000006";

describe("product image validation", () => {
  it.each([
    ["JPEG", storageImageFixtures.jpeg],
    ["PNG", storageImageFixtures.png],
    ["WebP", storageImageFixtures.webp],
  ])("accepts decoded %s bytes while preserving their original format", (_label, fixture) => {
    expect(validateDecodedProductImage({
      bytes: fixture.bytes,
      declaredMimeType: fixture.contentType,
      extension: fixture.extension,
      decoded: true,
    })).toEqual({ mimeType: fixture.contentType, extension: fixture.extension, byteSize: fixture.bytes.byteLength });
  });

  it("normalizes jpeg to the jpg storage extension", () => {
    expect(validateDecodedProductImage({
      bytes: storageImageFixtures.jpeg.bytes,
      declaredMimeType: "image/jpeg",
      extension: "jpeg",
      decoded: true,
    }).extension).toBe("jpg");
  });

  it.each([
    ["SVG", storageImageFixtures.svg.bytes, "image/svg+xml", "svg"],
    ["declared MIME mismatch", storageImageFixtures.png.bytes, "image/jpeg", "jpg"],
    ["extension mismatch", storageImageFixtures.webp.bytes, "image/webp", "png"],
    ["failed decode", storageImageFixtures.jpeg.bytes, "image/jpeg", "jpg"],
  ])("rejects %s", (label, bytes, declaredMimeType, extension) => {
    expect(() => validateDecodedProductImage({
      bytes,
      declaredMimeType,
      extension,
      decoded: label !== "failed decode",
    })).toThrow();
  });

  it("rejects an image larger than 2 MiB after processing", () => {
    expect(() => validateDecodedProductImage({
      bytes: createOversizedImageFixture(),
      declaredMimeType: "image/jpeg",
      extension: "jpg",
      decoded: true,
    })).toThrow();
  });

  it("rejects truncated magic bytes even when MIME and extension agree", () => {
    expect(() => validateDecodedProductImage({
      bytes: Uint8Array.from([0xff, 0xd8, 0xff]),
      declaredMimeType: "image/jpeg",
      extension: "jpg",
      decoded: true,
    })).toThrow();
  });
});

describe("product image paths", () => {
  it.each([
    ["image/jpeg", "jpg"],
    ["image/png", "png"],
    ["image/webp", "webp"],
  ] as const)("uses the owned product prefix, generated UUID, and %s extension", (mimeType, extension) => {
    expect(buildProductImagePath(productId, imageId, mimeType)).toBe(`products/${productId}/${imageId}.${extension}`);
  });

  it.each([
    ["../secrets", imageId, "image/jpeg"],
    [productId, "not-a-uuid", "image/jpeg"],
    [productId, imageId, "image/svg+xml"],
  ])("rejects unsafe path input", (candidateProductId, candidateImageId, mimeType) => {
    expect(() => buildProductImagePath(candidateProductId, candidateImageId, mimeType)).toThrow();
  });
});
