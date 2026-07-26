"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "../lib/auth/require-admin";
import { settingsSchema, type SettingsInput } from "../lib/validation/settings";
import { updateSellerSettings } from "../server/data/seller";
import { AppError } from "../server/errors/app-error";

type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: { code: string; message: string } };

export async function updateSettings(input: SettingsInput): Promise<ActionResult> {
  await requireAdmin();
  const parsed = settingsSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      error: { code: "VALIDATION_ERROR", message: "Periksa kembali data pengaturan toko." },
    };
  }

  try {
    await updateSellerSettings(parsed.data);
    revalidatePath("/");
    revalidatePath("/admin/pengaturan");
    return { ok: true, data: undefined };
  } catch (error: unknown) {
    if (error instanceof AppError) {
      return {
        ok: false,
        error: { code: error.code, message: "Pengaturan toko belum berhasil disimpan. Coba lagi." },
      };
    }

    return {
      ok: false,
      error: { code: "INTERNAL_ERROR", message: "Pengaturan toko belum berhasil disimpan. Coba lagi." },
    };
  }
}
