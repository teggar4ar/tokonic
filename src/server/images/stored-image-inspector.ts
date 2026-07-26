import "server-only";

import sharp from "sharp";
import { AppError } from "../errors/app-error";

export type StoredImageDecoder = (bytes: Uint8Array) => Promise<{
  format?: string;
  width?: number;
  height?: number;
}>;

const mimeByFormat = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
} as const;

const extensionByFormat = {
  jpeg: "jpg",
  png: "png",
  webp: "webp",
} as const;

export function createStoredImageInspector({ decode }: { decode: StoredImageDecoder }) {
  return async (input: {
    bytes: Uint8Array;
    storageContentType: string;
    extension: string;
    clientMimeType?: string;
    clientWidth?: number;
    clientHeight?: number;
  }) => {
    try {
      const decoded = await decode(input.bytes);
      if (!decoded.format || !(decoded.format in mimeByFormat) || !decoded.width || !decoded.height) throw new Error("invalid image");
      const format = decoded.format as keyof typeof mimeByFormat;
      const mimeType = mimeByFormat[format];
      const extension = input.extension.toLowerCase() === "jpeg" ? "jpg" : input.extension.toLowerCase();
      if (input.storageContentType !== mimeType || extension !== extensionByFormat[format]) throw new Error("metadata mismatch");
      return { mimeType, byteSize: input.bytes.byteLength, width: decoded.width, height: decoded.height };
    } catch (error) {
      throw new AppError("VALIDATION_ERROR", "Objek gambar tidak valid.", { cause: error });
    }
  };
}

export const inspectStoredImage = createStoredImageInspector({
  async decode(bytes) {
    const image = sharp(bytes, { failOn: "error" });
    const metadata = await image.metadata();
    await image.clone().raw().toBuffer();
    return metadata;
  },
});
