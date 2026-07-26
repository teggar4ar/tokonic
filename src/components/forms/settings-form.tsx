"use client";

import { useState } from "react";
import { CheckCircleIcon, ExclamationTriangleIcon, PhotoIcon } from "@heroicons/react/24/outline";
import { updateSettings } from "@/actions/settings";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { SettingsInput } from "@/lib/validation/settings";

type SettingsFormProps = { initialValue: SettingsInput };

export function SettingsForm({ initialValue }: SettingsFormProps) {
  const [feedback, setFeedback] = useState<{ kind: "success" | "error"; message: string }>();
  const [pending, setPending] = useState(false);
  const hasLogo = initialValue.logoBucket !== null && initialValue.logoPath !== null;

  async function submit(formData: FormData) {
    setPending(true);
    setFeedback(undefined);

    try {
      const result = await updateSettings({
        storeName: String(formData.get("storeName") ?? ""),
        logoBucket: initialValue.logoBucket,
        logoPath: initialValue.logoPath,
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
        <Field label="Nomor WhatsApp" name="whatsappPhone" defaultValue={initialValue.whatsappPhone} inputMode="tel" required />
        <div className="flex items-start gap-3 rounded-md border border-border bg-muted/40 p-4">
          <PhotoIcon className="mt-0.5 size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
          <div className="text-sm">
            <p className="font-semibold">Logo toko</p>
            <p className="mt-1 text-muted-foreground">
              {hasLogo
                ? "Logo toko sudah diatur. Penggantian logo akan tersedia bersama pengelolaan katalog."
                : "Belum ada logo. Unggah logo akan tersedia bersama pengelolaan katalog."}
            </p>
          </div>
        </div>
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
          <div className="grid gap-2">
            <Label htmlFor="originRajaongkirLevel">Tingkat lokasi</Label>
            <select
              id="originRajaongkirLevel"
              name="originRajaongkirLevel"
              defaultValue={initialValue.originRajaongkirLevel}
              className="h-control rounded-md border border-input bg-surface px-3 text-base"
              required
            >
              <option value="district">Kecamatan</option>
              <option value="subdistrict">Kelurahan/desa</option>
            </select>
          </div>
        </div>
        <Field label="Zona waktu" name="businessTimezone" defaultValue={initialValue.businessTimezone} readOnly />
      </section>

      <div className="grid gap-3">
        {feedback ? (
          <p
            className={`flex items-center gap-2 text-sm font-medium ${feedback.kind === "error" ? "text-destructive" : "text-success"}`}
            role={feedback.kind === "error" ? "alert" : "status"}
          >
            {feedback.kind === "error" ? (
              <ExclamationTriangleIcon className="size-5 shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircleIcon className="size-5 shrink-0" aria-hidden="true" />
            )}
            {feedback.message}
          </p>
        ) : null}
        <div>
          <Button type="submit" disabled={pending}>{pending ? "Menyimpan..." : "Simpan perubahan"}</Button>
        </div>
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
