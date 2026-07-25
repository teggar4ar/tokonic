export const storageImageFixtures = {
  jpeg: {
    contentType: "image/jpeg",
    extension: "jpg",
    bytes: Uint8Array.from([0xff, 0xd8, 0xff, 0xdb, 0x00, 0x43, 0xff, 0xd9]),
  },
  png: {
    contentType: "image/png",
    extension: "png",
    bytes: Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  },
  webp: {
    contentType: "image/webp",
    extension: "webp",
    bytes: Uint8Array.from([
      0x52, 0x49, 0x46, 0x46, 0x04, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50,
    ]),
  },
  svg: {
    contentType: "image/svg+xml",
    extension: "svg",
    bytes: new TextEncoder().encode("<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>"),
  },
} as const;

export function createOversizedImageFixture() {
  return new Uint8Array(2 * 1024 * 1024 + 1);
}
