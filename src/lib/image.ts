import { productImageMaximumBytes, productImageMimeSchema } from "./validation/product-images";

const formatByMime = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;

function detectedMimeType(bytes: Uint8Array) {
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9) return "image/jpeg";
  if (bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes.length >= 12 && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "image/webp";
  throw new Error("Format gambar tidak valid.");
}

function normalizedExtension(extension: string) {
  const value = extension.toLowerCase();
  return value === "jpeg" ? "jpg" : value;
}

export function validateDecodedProductImage(input: {
  bytes: Uint8Array;
  declaredMimeType: string;
  extension: string;
  decoded: boolean;
}) {
  if (!input.decoded || input.bytes.byteLength < 1 || input.bytes.byteLength > productImageMaximumBytes) throw new Error("Gambar tidak valid.");
  const mimeType = productImageMimeSchema.parse(input.declaredMimeType);
  const extension = normalizedExtension(input.extension);
  if (detectedMimeType(input.bytes) !== mimeType || formatByMime[mimeType] !== extension) throw new Error("Format gambar tidak cocok.");
  return { mimeType, extension, byteSize: input.bytes.byteLength };
}

export function buildProductImagePath(productId: string, imageId: string, mimeType: string) {
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuid.test(productId) || !uuid.test(imageId)) throw new Error("ID gambar tidak valid.");
  const parsedMime = productImageMimeSchema.parse(mimeType);
  return `products/${productId}/${imageId}.${formatByMime[parsedMime]}`;
}
