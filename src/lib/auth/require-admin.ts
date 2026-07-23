import "server-only";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requireAdmin() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    redirect("/admin/login");
  }

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .select("id")
    .eq("auth_user_id", data.user.id)
    .single();

  if (sellerError || !seller) {
    redirect("/admin/login");
  }

  return { userId: data.user.id, sellerId: seller.id };
}
