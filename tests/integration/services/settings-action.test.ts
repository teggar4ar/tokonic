import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  updateSellerSettings: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/server/data/seller", () => ({ updateSellerSettings: mocks.updateSellerSettings }));

import { updateSettings } from "../../../src/actions/settings";

const validInput = {
  storeName: "Toko Nikmat",
  logoBucket: null,
  logoPath: null,
  whatsappPhone: "6285712345678",
  originLabel: "Kecamatan Coblong, Kota Bandung",
  originAddress: "Jalan Sangkuriang No. 1",
  originRajaongkirId: "12345",
  originRajaongkirLevel: "district" as const,
  businessTimezone: "Asia/Jakarta" as const,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireAdmin.mockResolvedValue({
    userId: "10000000-0000-4000-8000-000000000001",
    sellerId: "20000000-0000-4000-8000-000000000001",
  });
  mocks.updateSellerSettings.mockResolvedValue(undefined);
});

describe("store settings mutation authorization", () => {
  it("rejects a missing admin session before attempting persistence or revalidation", async () => {
    mocks.requireAdmin.mockRejectedValue(new Error("NEXT_REDIRECT:/admin/login"));

    await expect(updateSettings(validInput)).rejects.toThrow("NEXT_REDIRECT:/admin/login");

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.updateSellerSettings).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("uses only the authenticated seller ID for persistence", async () => {
    await expect(updateSettings(validInput)).resolves.toEqual({ ok: true, data: undefined });

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(mocks.updateSellerSettings).toHaveBeenCalledWith(validInput);
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(1, "/");
    expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/admin/pengaturan");
  });
});
