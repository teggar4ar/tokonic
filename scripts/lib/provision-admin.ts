import { createClient } from "@supabase/supabase-js";

import type { ProvisionEnv } from "./provision-env";

export interface ProvisionResult {
  authUserId: string;
  sellerId: string;
  created: boolean;
}

export async function provisionAdmin(env: ProvisionEnv): Promise<ProvisionResult> {
  const supabase = createClient(env.API_URL, env.SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let authUserId: string;
  let created: boolean;

  const createResult = await supabase.auth.admin.createUser({
    email: env.CI_ADMIN_EMAIL,
    password: env.CI_ADMIN_PASSWORD,
    email_confirm: true,
  });

  if (createResult.data.user) {
    authUserId = createResult.data.user.id;
    created = true;
  } else if (
    createResult.error &&
    createResult.error.message.toLowerCase().includes("already been registered")
  ) {
    let existingUser = null;
    let page = 1;
    let hasMore = true;

    while (hasMore && !existingUser) {
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({
        page,
        perPage: 1000,
      });

      if (listError) throw new Error(`Failed to list users: ${listError.message}`);

      existingUser = listData.users.find((u) => u.email === env.CI_ADMIN_EMAIL);
      
      if (listData.users.length < 1000) {
        hasMore = false;
      } else {
        page++;
      }
    }

    if (!existingUser) {
      throw new Error(
        "Auth user reportedly exists but could not be found by email.",
      );
    }

    const { data, error } = await supabase.auth.admin.updateUserById(
      existingUser.id,
      { password: env.CI_ADMIN_PASSWORD, email_confirm: true },
    );
    if (error || !data.user) {
      throw new Error(
        `Failed to update Auth user: ${error?.message ?? "unknown error"}`,
      );
    }
    authUserId = data.user.id;
    created = false;
  } else {
    throw new Error(
      `Failed to create Auth user: ${createResult.error?.message ?? "unknown error"}`,
    );
  }

  const { data: seller, error: sellerError } = await supabase
    .from("sellers")
    .upsert(
      {
        auth_user_id: authUserId,
        store_name: env.CI_ADMIN_STORE_NAME,
        store_slug: env.CI_ADMIN_STORE_SLUG,
        whatsapp_phone: env.CI_ADMIN_WHATSAPP_PHONE,
        origin_label: env.CI_ADMIN_ORIGIN_LABEL,
        origin_address: env.CI_ADMIN_ORIGIN_ADDRESS,
        origin_rajaongkir_id: env.CI_ADMIN_ORIGIN_RAJAONGKIR_ID,
        origin_rajaongkir_level: env.CI_ADMIN_ORIGIN_RAJAONGKIR_LEVEL,
      },
      { onConflict: "auth_user_id" },
    )
    .select("id")
    .single();

  if (sellerError || !seller) {
    throw new Error(
      `Failed to upsert seller row: ${sellerError?.message ?? "unknown error"}`,
    );
  }

  return { authUserId, sellerId: seller.id, created };
}
