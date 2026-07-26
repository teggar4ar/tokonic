import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import {
  createStoredImageInspector,
  inspectStoredImage,
  type StoredImageDecoder,
} from "../../src/server/images/stored-image-inspector";

const variants = [
  { format: "jpeg", mimeType: "image/jpeg", extension: "jpg", width: 640, height: 480, bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]) },
  { format: "png", mimeType: "image/png", extension: "png", width: 800, height: 600, bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) },
  { format: "webp", mimeType: "image/webp", extension: "webp", width: 1024, height: 768, bytes: Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]) },
] as const;

describe("stored image inspector", () => {
  it.each(variants)("invokes the real decoder abstraction for valid $format bytes", async (variant) => {
    const decode = vi.fn<StoredImageDecoder>().mockResolvedValue({
      format: variant.format,
      width: variant.width,
      height: variant.height,
    });
    const inspect = createStoredImageInspector({ decode });

    await expect(inspect({
      bytes: variant.bytes,
      storageContentType: variant.mimeType,
      extension: variant.extension,
      clientMimeType: "image/jpeg",
      clientWidth: 1,
      clientHeight: 1,
    })).resolves.toEqual({
      mimeType: variant.mimeType,
      byteSize: variant.bytes.byteLength,
      width: variant.width,
      height: variant.height,
    });
    expect(decode).toHaveBeenCalledWith(variant.bytes);
  });

  it("derives format and dimensions from decoded bytes instead of client flags", async () => {
    const decode = vi.fn<StoredImageDecoder>().mockResolvedValue({ format: "png", width: 320, height: 240 });
    const inspect = createStoredImageInspector({ decode });

    await expect(inspect({
      bytes: variants[1].bytes,
      storageContentType: "image/png",
      extension: "png",
      clientMimeType: "image/webp",
      clientWidth: 9999,
      clientHeight: 9999,
    })).resolves.toMatchObject({ mimeType: "image/png", width: 320, height: 240 });
  });

  it.each([
    ["jpeg", Uint8Array.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10])],
    ["png", Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00])],
    ["webp", Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0x04, 0, 0, 0, 0x57, 0x45, 0x42, 0x50])],
  ])("rejects truncated %s bytes through the production full-pixel decoder", async (format, bytes) => {
    const mimeType = format === "jpeg" ? "image/jpeg" : `image/${format}`;
    const extension = format === "jpeg" ? "jpg" : format;

    await expect(inspectStoredImage({ bytes, storageContentType: mimeType, extension })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });

  it("rejects decoder failure even when client and Storage metadata appear valid", async () => {
    const decode = vi.fn<StoredImageDecoder>().mockRejectedValue(new Error("decode failed"));
    const inspect = createStoredImageInspector({ decode });

    await expect(inspect({
      bytes: variants[0].bytes,
      storageContentType: "image/jpeg",
      extension: "jpg",
      clientMimeType: "image/jpeg",
      clientWidth: 640,
      clientHeight: 480,
    })).rejects.toMatchObject({ code: "VALIDATION_ERROR" });
  });
});
