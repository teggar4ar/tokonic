import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

import { beforeAll, describe, expect, it } from "vitest";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "../../../src/lib/supabase/database.types";

import {
  createAnonClient,
  createAuthenticatedAdminClient,
  createServiceRoleClient,
  createUnrelatedAuthenticatedClient,
  readDisposableStackEnvironment,
  readProvisionedAdmin,
} from "../helpers/supabase-clients";

type SellerUpdate = Database["public"]["Tables"]["sellers"]["Update"];

let anonClient: SupabaseClient<Database>;
let ownerClient: SupabaseClient<Database>;
let unrelatedClient: SupabaseClient<Database>;
let serviceRoleClient: SupabaseClient<Database>;
let ownerSellerId: string;

beforeAll(async () => {
  serviceRoleClient = createServiceRoleClient();
  anonClient = createAnonClient();
  ownerClient = await createAuthenticatedAdminClient();
  unrelatedClient = await createUnrelatedAuthenticatedClient();

  const admin = readProvisionedAdmin();
  const { data } = await serviceRoleClient
    .from("sellers")
    .select("id")
    .eq("store_slug", admin.storeSlug)
    .single();
  if (!data) throw new Error("Provisioned seller row not found");
  ownerSellerId = data.id;
});

describe("seller RLS — anon isolation", () => {
  it("cannot read any seller rows", async () => {
    const { data, error } = await anonClient.from("sellers").select("id");

    expect(error).not.toBeNull();
    expect(data).toBeNull();
  });

  it("cannot insert a seller row", async () => {
    const { error } = await anonClient.from("sellers").insert({
      auth_user_id: "00000000-0000-0000-0000-000000000000",
      store_name: "Anon Store",
      store_slug: "anon-store",
      whatsapp_phone: "6280000000001",
      origin_label: "Test",
      origin_address: "Test address",
      origin_rajaongkir_id: "1",
      origin_rajaongkir_level: "district" as const,
    });

    expect(error).not.toBeNull();
  });

  it("cannot update any seller row", async () => {
    const { data, error } = await anonClient
      .from("sellers")
      .update({ store_name: "Hacked" } as SellerUpdate)
      .eq("id", ownerSellerId)
      .select("id");

    const blocked = error !== null || (Array.isArray(data) && data.length === 0);
    expect(blocked).toBe(true);
  });

  it("cannot delete any seller row", async () => {
    const { error } = await anonClient
      .from("sellers")
      .delete()
      .eq("id", ownerSellerId);

    expect(error).not.toBeNull();
  });
});

describe("seller RLS — owner access", () => {
  it("can read only its own row", async () => {
    const { data, error } = await ownerClient.from("sellers").select("id, store_slug");

    expect(error).toBeNull();
    expect(data).toHaveLength(1);
    expect(data![0].id).toBe(ownerSellerId);
  });

  it("can update its own mutable fields", async () => {
    const originalName = "CI Test Store";
    const updatedName = "Updated CI Store";

    const { data: updated, error: updateError } = await ownerClient
      .from("sellers")
      .update({ store_name: updatedName })
      .eq("id", ownerSellerId)
      .select("store_name")
      .single();

    expect(updateError).toBeNull();
    expect(updated?.store_name).toBe(updatedName);

    const { error: restoreError } = await ownerClient
      .from("sellers")
      .update({ store_name: originalName })
      .eq("id", ownerSellerId);

    expect(restoreError).toBeNull();
  });

  it("cannot update immutable identity fields", async () => {
    const { error } = await ownerClient
      .from("sellers")
      .update({ id: "00000000-0000-0000-0000-000000000099" } as unknown as SellerUpdate)
      .eq("id", ownerSellerId);

    expect(error).not.toBeNull();
  });

  it("cannot insert a new seller row", async () => {
    const { error } = await ownerClient.from("sellers").insert({
      auth_user_id: "00000000-0000-0000-0000-000000000000",
      store_name: "Second Store",
      store_slug: "second-store",
      whatsapp_phone: "6280000000002",
      origin_label: "Test",
      origin_address: "Test address",
      origin_rajaongkir_id: "1",
      origin_rajaongkir_level: "district" as const,
    });

    expect(error).not.toBeNull();
  });

  it("cannot delete its own row", async () => {
    const { error } = await ownerClient
      .from("sellers")
      .delete()
      .eq("id", ownerSellerId);

    expect(error).not.toBeNull();
  });
});

describe("seller RLS — unrelated authenticated user isolation", () => {
  it("reads zero seller rows", async () => {
    const { data, error } = await unrelatedClient.from("sellers").select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot update any seller row", async () => {
    const { data, error } = await unrelatedClient
      .from("sellers")
      .update({ store_name: "Hijacked" })
      .eq("id", ownerSellerId)
      .select("id");

    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("cannot insert a seller row", async () => {
    const { error } = await unrelatedClient.from("sellers").insert({
      auth_user_id: "00000000-0000-0000-0000-000000000000",
      store_name: "Intruder Store",
      store_slug: "intruder-store",
      whatsapp_phone: "6280000000003",
      origin_label: "Test",
      origin_address: "Test address",
      origin_rajaongkir_id: "1",
      origin_rajaongkir_level: "district" as const,
    });

    expect(error).not.toBeNull();
  });

  it("cannot delete any seller row", async () => {
    const { error } = await unrelatedClient
      .from("sellers")
      .delete()
      .eq("id", ownerSellerId);

    expect(error).not.toBeNull();
  });
});

describe("seller RLS — requireAdmin() query pattern", () => {
  it("owner finds their linked seller via auth_user_id", async () => {
    const { data: { user } } = await ownerClient.auth.getUser();
    expect(user).not.toBeNull();

    const { data, error } = await ownerClient
      .from("sellers")
      .select("id")
      .eq("auth_user_id", user!.id)
      .single();

    expect(error).toBeNull();
    expect(data).not.toBeNull();
    expect(data!.id).toBe(ownerSellerId);
  });

  it("unrelated authenticated user finds no seller via auth_user_id", async () => {
    const { data: { user } } = await unrelatedClient.auth.getUser();
    expect(user).not.toBeNull();

    const { data, error } = await unrelatedClient
      .from("sellers")
      .select("id")
      .eq("auth_user_id", user!.id)
      .maybeSingle();

    expect(data).toBeNull();
    if (error) expect(error.code).not.toBe("PGRST116");
  });

  it("anon cannot query sellers by auth_user_id", async () => {
    const { data, error } = await anonClient
      .from("sellers")
      .select("id")
      .eq("auth_user_id", "00000000-0000-0000-0000-000000000000")
      .maybeSingle();

    expect(data).toBeNull();
    expect(error).not.toBeNull();
  });
});

describe("seller table privilege matrix", () => {
  it("anon has no table privileges", async () => {
    const privileges = querySellerPrivileges();
    const anon = privileges.find(({ role_name }) => role_name === "anon");

    expect(anon).toBeDefined();
    expect(anon!.has_select).toBe(false);
    expect(anon!.has_insert).toBe(false);
    expect(anon!.has_update).toBe(false);
    expect(anon!.has_delete).toBe(false);
  });

  it("authenticated has SELECT and column-scoped UPDATE only", async () => {
    const privileges = querySellerPrivileges();
    const auth = privileges.find(({ role_name }) => role_name === "authenticated");

    expect(auth).toBeDefined();
    expect(auth!.has_select).toBe(true);
    expect(auth!.has_insert).toBe(false);
    expect(auth!.has_delete).toBe(false);

    const columnUpdate = queryColumnUpdatePrivilege("authenticated", "store_name");
    expect(columnUpdate).toBe(true);

    const immutableColumnUpdate = queryColumnUpdatePrivilege("authenticated", "id");
    expect(immutableColumnUpdate).toBe(false);
  });

  it("service_role has SELECT, INSERT, and UPDATE only", async () => {
    const privileges = querySellerPrivileges();
    const sr = privileges.find(({ role_name }) => role_name === "service_role");

    expect(sr).toBeDefined();
    expect(sr!.has_select).toBe(true);
    expect(sr!.has_insert).toBe(true);
    expect(sr!.has_update).toBe(true);
    expect(sr!.has_delete).toBe(false);
  });

  it("RLS is enabled on the sellers table", async () => {
    const result = queryRlsEnabled();

    expect(result).toHaveLength(1);
    expect(result[0].rowsecurity).toBe(true);
  });

  it("policies enforce auth.uid() ownership predicates", async () => {
    const policies = querySellerPolicies();

    expect(policies.length).toBeGreaterThanOrEqual(2);

    const selectPolicy = policies.find((p) => p.cmd === "r");
    const updatePolicy = policies.find((p) => p.cmd === "w");

    expect(selectPolicy).toBeDefined();
    expect(selectPolicy!.qual).toContain("auth.uid()");

    expect(updatePolicy).toBeDefined();
    expect(updatePolicy!.qual).toContain("auth.uid()");
    expect(updatePolicy!.with_check).toContain("auth.uid()");
  });
});

function queryDisposableDatabase<T>(query: string): T[] {
  readDisposableStackEnvironment();

  const databaseUrl = process.env.DB_URL;
  if (!databaseUrl) throw new Error('Missing required Supabase env var "DB_URL".');
  const hostname = new URL(databaseUrl).hostname;
  if (hostname !== "127.0.0.1" && hostname !== "localhost" && hostname !== "::1") {
    throw new Error("Integration tests require a loopback PostgreSQL URL.");
  }
  const cli = resolve("node_modules", ".bin", process.platform === "win32" ? "supabase.cmd" : "supabase");
  const output = execFileSync(
    cli,
    ["db", "query", "--db-url", databaseUrl, "--output-format", "json", query],
    { encoding: "utf8", windowsHide: true },
  );
  return JSON.parse(output) as T[];
}

function querySellerPrivileges() {
  return queryDisposableDatabase<{
    role_name: string;
    has_select: boolean;
    has_insert: boolean;
    has_update: boolean;
    has_delete: boolean;
  }>(
    "with roles(role_name, role_oid) as (values ('anon', pg_catalog.to_regrole('anon')::oid), ('authenticated', pg_catalog.to_regrole('authenticated')::oid), ('service_role', pg_catalog.to_regrole('service_role')::oid)) select role_name, pg_catalog.has_table_privilege(role_oid, 'public.sellers', 'SELECT') as has_select, pg_catalog.has_table_privilege(role_oid, 'public.sellers', 'INSERT') as has_insert, pg_catalog.has_table_privilege(role_oid, 'public.sellers', 'UPDATE') as has_update, pg_catalog.has_table_privilege(role_oid, 'public.sellers', 'DELETE') as has_delete from roles order by role_name",
  );
}

function queryColumnUpdatePrivilege(roleName: string, columnName: string): boolean {
  const result = queryDisposableDatabase<{ has_privilege: boolean }>(
    `select pg_catalog.has_column_privilege(pg_catalog.to_regrole('${roleName}')::oid, 'public.sellers', '${columnName}', 'UPDATE') as has_privilege`,
  );
  return result[0]?.has_privilege ?? false;
}

function queryRlsEnabled() {
  return queryDisposableDatabase<{ rowsecurity: boolean }>(
    "select relrowsecurity as rowsecurity from pg_catalog.pg_class where relname = 'sellers' and relnamespace = 'public'::regnamespace",
  );
}

function querySellerPolicies() {
  return queryDisposableDatabase<{
    policyname: string;
    cmd: string;
    qual: string;
    with_check: string | null;
  }>(
    "select polname as policyname, case polcmd when 'r' then 'r' when 'w' then 'w' when 'a' then 'a' when 'd' then 'd' when '*' then '*' end as cmd, pg_catalog.pg_get_expr(polqual, polrelid) as qual, pg_catalog.pg_get_expr(polwithcheck, polrelid) as with_check from pg_catalog.pg_policy where polrelid = 'public.sellers'::regclass order by polname",
  );
}
