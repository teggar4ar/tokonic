import { AdminPageHeader } from "@/components/admin/admin-page-header";
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
    <main className="px-gutter py-8">
      <AdminPageHeader title="Pengaturan toko" description="Kelola identitas toko dan lokasi asal pengiriman." />
      <div className="mt-6 max-w-3xl">
        <SettingsForm initialValue={settings.data} />
      </div>
    </main>
  );
}
