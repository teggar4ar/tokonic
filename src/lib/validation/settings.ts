import { z } from "zod";

const nullableLogoValue = z.string().trim().min(1).max(255).nullable();

const whatsappPhoneSchema = z.string().max(32).transform((value, context) => {
  const trimmed = value.trim();

  if (!/^\+?[0-9\s().-]+$/.test(trimmed)) {
    context.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid" });
    return z.NEVER;
  }

  const digits = trimmed.replace(/\D/g, "");
  const normalized = digits.startsWith("0") ? `62${digits.slice(1)}` : digits;

  if (!/^62[1-9][0-9]{7,12}$/.test(normalized)) {
    context.addIssue({ code: "custom", message: "Nomor WhatsApp tidak valid" });
    return z.NEVER;
  }

  return normalized;
});

export const settingsSchema = z
  .object({
    storeName: z.string().trim().min(1).max(120),
    logoBucket: nullableLogoValue,
    logoPath: nullableLogoValue,
    whatsappPhone: whatsappPhoneSchema,
    originLabel: z.string().trim().min(1).max(255),
    originAddress: z.string().trim().min(1).max(500),
    originRajaongkirId: z.string().trim().min(1).max(100),
    originRajaongkirLevel: z.enum(["district", "subdistrict"]),
    businessTimezone: z.literal("Asia/Jakarta"),
  })
  .refine((value) => (value.logoBucket === null) === (value.logoPath === null), {
    message: "Metadata logo harus diisi berpasangan",
    path: ["logoPath"],
  });

export type SettingsInput = z.infer<typeof settingsSchema>;
