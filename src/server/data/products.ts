import "server-only";

import { requireAdmin } from "../../lib/auth/require-admin";
import { createClient } from "../../lib/supabase/server";
import type { ProductCreateInput } from "../../lib/validation/products";
import { AppError } from "../errors/app-error";

const productColumns = "id, seller_id, slug, name, description, price, stock, weight_grams, is_published";

type ProductRow = {
  id: string;
  seller_id: string;
  slug: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  weight_grams: number;
  is_published: boolean;
};

function mapProduct(row: ProductRow) {
  return {
    id: row.id,
    sellerId: row.seller_id,
    slug: row.slug,
    name: row.name,
    description: row.description,
    price: row.price,
    stock: row.stock,
    weightGrams: row.weight_grams,
    isPublished: row.is_published,
  };
}

async function verifySeller(sellerId: string) {
  const admin = await requireAdmin();

  if (admin.sellerId !== sellerId) {
    throw new AppError("FORBIDDEN", "Akses produk ditolak.");
  }
}

function productValues(input: ProductCreateInput) {
  return {
    slug: input.slug,
    name: input.name,
    description: input.description,
    price: input.price,
    stock: input.stock,
    weight_grams: input.weightGrams,
    is_published: input.isPublished,
  };
}

export async function getPublishedProductsForCart(productIds: string[]) {
  if (productIds.length === 0) {
    return [];
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, price, stock, is_published")
    .in("id", productIds)
    .eq("is_published", true);

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Produk keranjang tidak dapat dimuat.", { cause: error });
  }

  return data.map((product) => ({
    id: product.id,
    name: product.name,
    priceRupiah: String(product.price),
    stock: product.stock,
    isPublished: product.is_published,
  }));
}

export async function createProduct(sellerId: string, input: ProductCreateInput) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ seller_id: sellerId, ...productValues(input) })
    .select(productColumns)
    .single();

  if (error || !data) {
    throw new AppError(error?.code === "23505" ? "CONFLICT" : "INTERNAL_ERROR", "Produk tidak dapat dibuat.", { cause: error });
  }

  return mapProduct(data);
}

export async function updateOwnedProduct(sellerId: string, productId: string, input: ProductCreateInput) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update(productValues(input))
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .select(productColumns)
    .maybeSingle();

  if (error) {
    throw new AppError(error.code === "23505" ? "CONFLICT" : "INTERNAL_ERROR", "Produk tidak dapat diperbarui.", { cause: error });
  }

  if (!data) {
    throw new AppError("NOT_FOUND", "Produk tidak ditemukan.");
  }

  return mapProduct(data);
}

export async function unpublishOwnedProduct(sellerId: string, productId: string) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .update({ is_published: false })
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .select(productColumns)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Produk tidak dapat dinonaktifkan.", { cause: error });
  }

  if (!data) {
    throw new AppError("NOT_FOUND", "Produk tidak ditemukan.");
  }

  return mapProduct(data);
}

export async function listOwnedProductImagePaths(sellerId: string, productId: string) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
  const { data, error } = await rpc("begin_product_deletion", { p_product_id: productId });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new AppError(error?.code === "P0002" ? "NOT_FOUND" : "INTERNAL_ERROR", "Penghapusan produk tidak dapat dimulai.", { cause: error });
  const paths = (data as Record<string, unknown>).object_paths;
  if (!Array.isArray(paths) || !paths.every((path) => typeof path === "string")) throw new AppError("INTERNAL_ERROR", "Daftar gambar produk tidak valid.");
  return paths;
}

export async function removeOwnedProductImageObjects(sellerId: string, bucket: string, paths: string[]) {
  await verifySeller(sellerId);
  if (bucket !== "product-images") throw new AppError("VALIDATION_ERROR", "Bucket gambar tidak valid.");
  if (paths.length === 0) return { removed: [], notFound: [] };
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  if (error) {
    const status = "statusCode" in error ? String(error.statusCode) : "";
    if (status === "404" || error.name === "NotFound") return { removed: [], notFound: paths };
    throw new AppError("INTERNAL_ERROR", "Objek gambar tidak dapat dihapus.", { cause: error });
  }
  const removed = data.map((object) => object.name).filter((path) => paths.includes(path));
  return { removed, notFound: paths.filter((path) => !removed.includes(path)) };
}

export async function hardDeleteOwnedProduct(sellerId: string, productId: string, cleanedPaths: string[] = []) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const rpc = supabase.rpc as unknown as (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { code?: string } | null }>;
  const { data, error } = await rpc("finalize_product_deletion", { p_product_id: productId, p_cleaned_object_paths: cleanedPaths });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new AppError("INTERNAL_ERROR", "Produk tidak dapat dihapus.", { cause: error });
  const result = data as Record<string, unknown>;
  return { id: productId, sellerId, slug: typeof result.slug === "string" ? result.slug : "" };
}
