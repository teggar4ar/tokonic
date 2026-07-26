import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  createClient: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../src/lib/auth/require-admin", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("../../../src/lib/supabase/server", () => ({ createClient: mocks.createClient }));

import { updateSellerSettings } from "../../../src/server/data/seller";

const input = {
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
});

describe("seller settings persistence", () => {
  it("independently authorizes and updates exactly the authenticated seller row", async () => {
    const single = vi.fn().mockResolvedValue({
      data: { id: "20000000-0000-4000-8000-000000000001" },
      error: null,
    });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    const update = vi.fn().mockReturnValue({ eq });
    mocks.createClient.mockResolvedValue({ from: vi.fn().mockReturnValue({ update }) });

    await expect(updateSellerSettings(input)).resolves.toBeUndefined();

    expect(mocks.requireAdmin).toHaveBeenCalledOnce();
    expect(eq).toHaveBeenCalledWith("id", "20000000-0000-4000-8000-000000000001");
    expect(select).toHaveBeenCalledWith("id");
    expect(single).toHaveBeenCalledOnce();
  });

  it("fails safely when no owned row was updated", async () => {
    const single = vi.fn().mockResolvedValue({ data: null, error: { code: "PGRST116" } });
    const select = vi.fn().mockReturnValue({ single });
    const eq = vi.fn().mockReturnValue({ select });
    mocks.createClient.mockResolvedValue({
      from: vi.fn().mockReturnValue({ update: vi.fn().mockReturnValue({ eq }) }),
    });

    await expect(updateSellerSettings(input)).rejects.toMatchObject({
      code: "INTERNAL_ERROR",
      message: "Store settings update failed",
    });
  });
});
