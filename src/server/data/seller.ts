import "server-only";

import { requireAdmin } from "../../lib/auth/require-admin";
import { createClient } from "../../lib/supabase/server";
import type { SettingsInput } from "../../lib/validation/settings";
import { AppError } from "../errors/app-error";

const settingsColumns =
  "id, store_name, store_slug, logo_bucket, logo_path, whatsapp_phone, origin_label, origin_address, origin_rajaongkir_id, origin_rajaongkir_level, business_timezone";

export async function getCurrentSeller() {
  const { sellerId } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sellers")
    .select(settingsColumns)
    .eq("id", sellerId)
    .single();

  if (error || !data) {
    throw new AppError("NOT_FOUND", "Seller data is unavailable", { cause: error });
  }

  return data;
}

export async function updateSellerSettings(input: SettingsInput) {
  const { sellerId } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sellers")
    .update({
      store_name: input.storeName,
      logo_bucket: input.logoBucket,
      logo_path: input.logoPath,
      whatsapp_phone: input.whatsappPhone,
      origin_label: input.originLabel,
      origin_address: input.originAddress,
      origin_rajaongkir_id: input.originRajaongkirId,
      origin_rajaongkir_level: input.originRajaongkirLevel,
      business_timezone: input.businessTimezone,
    })
    .eq("id", sellerId)
    .select("id")
    .single();

  if (error || !data || data.id !== sellerId) {
    throw new AppError("INTERNAL_ERROR", "Store settings update failed", { cause: error });
  }
}

export async function hasSellerForCurrentUser() {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return false;
  }

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select("id")
    .eq("auth_user_id", userData.user.id)
    .maybeSingle();

  if (sellerError) {
    throw new AppError("INTERNAL_ERROR", "Seller lookup failed", { cause: sellerError });
  }

  return seller !== null;
}
