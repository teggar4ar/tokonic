"use client";

import imageCompression from "browser-image-compression";
import { validateDecodedProductImage } from "./image";

function extensionOf(file: File) {
  return file.name.split(".").pop()?.toLowerCase() ?? "";
}

async function decodeDimensions(file: File) {
  const bitmap = await createImageBitmap(file);
  try {
    return { width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}

export async function prepareProductImage(file: File) {
  const compressed = await imageCompression(file, {
    maxSizeMB: 2,
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    useWebWorker: true,
    fileType: file.type,
  });
  const dimensions = await decodeDimensions(compressed);
  const bytes = new Uint8Array(await compressed.arrayBuffer());
  const validated = validateDecodedProductImage({
    bytes,
    declaredMimeType: compressed.type,
    extension: extensionOf(file),
    decoded: dimensions.width > 0 && dimensions.height > 0,
  });
  return { file: compressed, ...validated, ...dimensions };
}
