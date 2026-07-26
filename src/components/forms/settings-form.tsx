"use client";

import { useState } from "react";
import { updateSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingsInput } from "@/lib/validation/settings";

type SettingsFormProps = { initialValue: SettingsInput };

export function SettingsForm({ initialValue }: SettingsFormProps) {
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string }>();
  const [pending, setPending] = useState(false);

  async function submit(formData: FormData) {
    setPending(true);
    setFeedback(undefined);

    try {
      const logoBucket = String(formData.get("logoBucket") ?? "").trim();
      const logoPath = String(formData.get("logoPath") ?? "").trim();
      const result = await updateSettings({
        storeName: String(formData.get("storeName") ?? ""),
        logoBucket: logoBucket || null,
        logoPath: logoPath || null,
        whatsappPhone: String(formData.get("whatsappPhone") ?? ""),
        originLabel: String(formData.get("originLabel") ?? ""),
        originAddress: String(formData.get("originAddress") ?? ""),
        originRajaongkirId: String(formData.get("originRajaongkirId") ?? ""),
        originRajaongkirLevel: String(formData.get("originRajaongkirLevel") ?? "") as SettingsInput["originRajaongkirLevel"],
        businessTimezone: String(formData.get("businessTimezone") ?? "") as SettingsInput["businessTimezone"],
      });

      setFeedback(
        result.ok
          ? { kind: "success", message: "Pengaturan toko berhasil disimpan." }
          : { kind: "error", message: result.error.message },
      );
    } catch {
      setFeedback({ kind: "error", message: "Pengaturan toko belum berhasil disimpan. Coba lagi." });
    } finally {
      setPending(false);
    }
  }

  return (
    <form action={submit} className="grid gap-8">
      <section className="grid gap-4 border-b border-border pb-8">
        <div>
          <h2 className="text-lg font-semibold">Identitas toko</h2>
          <p className="mt-1 text-sm text-muted-foreground">Informasi yang ditampilkan kepada pembeli.</p>
        </div>
        <Field label="Nama toko" name="storeName" defaultValue={initialValue.storeName} maxLength={120} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Bucket logo" name="logoBucket" defaultValue={initialValue.logoBucket ?? ""} maxLength={255} />
          <Field label="Path logo" name="logoPath" defaultValue={initialValue.logoPath ?? ""} maxLength={255} />
        </div>
        <Field label="Nomor WhatsApp" name="whatsappPhone" defaultValue={initialValue.whatsappPhone} inputMode="tel" required />
      </section>

      <section className="grid gap-4">
        <div>
          <h2 className="text-lg font-semibold">Asal pengiriman</h2>
          <p className="mt-1 text-sm text-muted-foreground">Digunakan sebagai asal perhitungan ongkos kirim.</p>
        </div>
        <Field label="Label lokasi" name="originLabel" defaultValue={initialValue.originLabel} maxLength={255} required />
        <Field label="Alamat lengkap" name="originAddress" defaultValue={initialValue.originAddress} maxLength={500} required />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="ID RajaOngkir" name="originRajaongkirId" defaultValue={initialValue.originRajaongkirId} required />
          <label className="grid gap-2 text-sm font-semibold">
            Tingkat lokasi
            <select name="originRajaongkirLevel" defaultValue={initialValue.originRajaongkirLevel} className="h-control rounded-md border border-input bg-surface px-3 text-base" required>
              <option value="district">Kecamatan</option>
              <option value="subdistrict">Kelurahan/desa</option>
            </select>
          </label>
        </div>
        <Field label="Zona waktu" name="businessTimezone" defaultValue={initialValue.businessTimezone} readOnly />
      </section>

      {feedback ? (
        <p className="text-sm" role={feedback.kind === "error" ? "alert" : "status"}>
          {feedback.message}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan perubahan"}</Button>
      </div>
    </form>
  );
}

type FieldProps = React.ComponentProps<typeof Input> & { label: string; name: string };

function Field({ label, name, ...props }: FieldProps) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={name}>{label}</Label>
      <Input id={name} name={name} {...props} />
    </div>
  );
}
