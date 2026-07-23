import "server-only";

import { requireAdmin } from "@/lib/auth/require-admin";
import { createClient } from "@/lib/supabase/server";
import { AppError } from "@/server/errors/app-error";

export async function getCurrentSeller() {
  const { sellerId } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sellers")
    .select("id, store_name, store_slug")
    .eq("id", sellerId)
    .single();

  if (error || !data) {
    throw new AppError("NOT_FOUND", "Seller data is unavailable", { cause: error });
  }

  return data;
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
