import { SettingsForm } from "@/components/forms/settings-form";
import { settingsSchema } from "@/lib/validation/settings";
import { AppError } from "@/server/errors/app-error";
import { getCurrentSeller } from "@/server/data/seller";

export default async function SettingsPage() {
  const seller = await getCurrentSeller();
  const settings = settingsSchema.safeParse({
    storeName: seller.store_name,
    logoBucket: seller.logo_bucket,
    logoPath: seller.logo_path,
    whatsappPhone: seller.whatsapp_phone,
    originLabel: seller.origin_label,
    originAddress: seller.origin_address,
    originRajaongkirId: seller.origin_rajaongkir_id,
    originRajaongkirLevel: seller.origin_rajaongkir_level,
    businessTimezone: seller.business_timezone,
  });

  if (!settings.success) {
    throw new AppError("INTERNAL_ERROR", "Store settings are invalid");
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-gutter py-10">
      <header className="mb-8">
        <p className="text-sm font-semibold text-muted-foreground">Admin Tokonic</p>
        <h1 className="mt-1 text-3xl font-bold">Pengaturan toko</h1>
        <p className="mt-2 text-muted-foreground">Kelola identitas toko dan lokasi asal pengiriman.</p>
      </header>
      <SettingsForm initialValue={settings.data} />
    </main>
  );
}
