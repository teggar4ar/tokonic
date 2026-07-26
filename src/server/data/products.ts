import "server-only";

import { requireAdmin } from "../../lib/auth/require-admin";
import { createClient } from "../../lib/supabase/server";
import { productSlugSchema, type ProductCreateInput } from "../../lib/validation/products";
import { AppError } from "../errors/app-error";
import { isConfirmedStorageNotFound } from "../storage/storage-absence";

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
  };
}

type ProductPublicationRow = {
  id: unknown;
  seller_id: unknown;
  slug: unknown;
  name: unknown;
  description: unknown;
  price: unknown;
  stock: unknown;
  weight_grams: unknown;
  is_published: unknown;
};

function mapPublicationResult(data: unknown) {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new AppError("INTERNAL_ERROR", "Status publikasi produk tidak valid.");
  }

  const row = data as ProductPublicationRow;
  return mapProduct({
    id: String(row.id),
    seller_id: String(row.seller_id),
    slug: String(row.slug),
    name: String(row.name),
    description: String(row.description),
    price: Number(row.price),
    stock: Number(row.stock),
    weight_grams: Number(row.weight_grams),
    is_published: row.is_published === true,
  });
}

async function setOwnedProductPublication(productId: string, isPublished: boolean) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("set_product_publication", {
    p_product_id: productId,
    p_is_published: isPublished,
  });

  if (error) {
    throw new AppError(
      error.code === "P0002" ? "NOT_FOUND" : error.code === "55000" ? "CONFLICT" : "INTERNAL_ERROR",
      "Status publikasi produk tidak dapat diubah.",
      { cause: error },
    );
  }

  return mapPublicationResult(data);
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

export async function listPublishedProducts() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, price, stock, product_images(object_path, display_order)")
    .eq("is_published", true)
    .order("created_at", { ascending: false });

  if (error || !data) {
    throw new AppError("INTERNAL_ERROR", "Katalog produk tidak dapat dimuat.", { cause: error });
  }

  return data.map((product) => {
    const primaryImage = [...product.product_images].sort(
      (a, b) => a.display_order - b.display_order,
    )[0];

    return {
      id: product.id,
      slug: product.slug,
      name: product.name,
      priceRupiah: String(product.price),
      stock: product.stock,
      primaryImagePath: primaryImage ? primaryImage.object_path : null,
    };
  });
}

export async function getPublishedProductBySlug(slug: string) {
  const parsedSlug = productSlugSchema.safeParse(slug);

  if (!parsedSlug.success) {
    return null;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, slug, name, description, price, stock, product_images(object_path, display_order)")
    .eq("slug", parsedSlug.data)
    .eq("is_published", true)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Detail produk tidak dapat dimuat.", { cause: error });
  }

  if (!data) {
    return null;
  }

  return {
    id: data.id,
    slug: data.slug,
    name: data.name,
    description: data.description,
    priceRupiah: String(data.price),
    stock: data.stock,
    imagePaths: [...data.product_images]
      .sort((a, b) => a.display_order - b.display_order)
      .map((image) => image.object_path),
  };
}

export async function listOwnedProducts() {
  const { sellerId } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, price, stock, is_published")
    .eq("seller_id", sellerId)
    .order("name", { ascending: true });

  if (error || !data) {
    throw new AppError("INTERNAL_ERROR", "Daftar produk tidak dapat dimuat.", { cause: error });
  }

  return data.map((product) => ({
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceRupiah: String(product.price),
    stock: product.stock,
    isPublished: product.is_published,
  }));
}

export async function getOwnedProduct(productId: string) {
  const { sellerId } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .select("id, name, slug, description, price, stock, weight_grams, is_published")
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (error) {
    throw new AppError("INTERNAL_ERROR", "Produk tidak dapat dimuat.", { cause: error });
  }

  if (!data) {
    throw new AppError("NOT_FOUND", "Produk tidak ditemukan.");
  }

  return {
    id: data.id,
    name: data.name,
    slug: data.slug,
    description: data.description,
    price: data.price,
    stock: data.stock,
    weightGrams: data.weight_grams,
    isPublished: data.is_published,
  };
}

export async function listOwnedProductImages(productId: string) {
  const { sellerId } = await requireAdmin();
  const supabase = await createClient();
  const { data: product, error: productError } = await supabase
    .from("products")
    .select("id")
    .eq("id", productId)
    .eq("seller_id", sellerId)
    .maybeSingle();

  if (productError) {
    throw new AppError("INTERNAL_ERROR", "Produk tidak dapat diverifikasi.", { cause: productError });
  }

  if (!product) {
    throw new AppError("NOT_FOUND", "Produk tidak ditemukan.");
  }

  const { data, error } = await supabase
    .from("product_images")
    .select("id, object_path, display_order")
    .eq("product_id", productId)
    .order("display_order", { ascending: true });

  if (error || !data) {
    throw new AppError("INTERNAL_ERROR", "Gambar produk tidak dapat dimuat.", { cause: error });
  }

  return data.map((image) => ({
    id: image.id,
    objectPath: image.object_path,
    displayOrder: image.display_order,
  }));
}

export async function createProduct(sellerId: string, input: ProductCreateInput) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("products")
    .insert({ seller_id: sellerId, ...productValues(input), is_published: input.isPublished })
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

  if (data.is_published !== input.isPublished) {
    return await setOwnedProductPublication(productId, input.isPublished);
  }

  return mapProduct(data);
}

export async function unpublishOwnedProduct(sellerId: string, productId: string) {
  await verifySeller(sellerId);
  return await setOwnedProductPublication(productId, false);
}

export async function listOwnedProductImagePaths(sellerId: string, productId: string) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("begin_product_deletion", { p_product_id: productId });
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
    const confirmedAbsent: string[] = [];
    for (const path of paths) {
      const result = await supabase.storage.from(bucket).download(path);
      if (!result.error || !isConfirmedStorageNotFound(result.error)) {
        throw new AppError("INTERNAL_ERROR", "Objek gambar tidak dapat dihapus.", { cause: error });
      }
      confirmedAbsent.push(path);
    }
    return { removed: [], notFound: confirmedAbsent };
  }
  const removed = data.map((object) => object.name).filter((path) => paths.includes(path));
  const unresolved: string[] = [];
  for (const path of paths.filter((path) => !removed.includes(path))) {
    const result = await supabase.storage.from(bucket).download(path);
    if (!result.error || !isConfirmedStorageNotFound(result.error)) unresolved.push(path);
  }
  if (unresolved.length > 0) throw new AppError("INTERNAL_ERROR", "Penghapusan gambar produk belum lengkap.");
  return { removed, notFound: paths.filter((path) => !removed.includes(path)) };
}

export async function hardDeleteOwnedProduct(sellerId: string, productId: string, cleanedPaths: string[] = []) {
  await verifySeller(sellerId);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("finalize_product_deletion", { p_product_id: productId, p_cleaned_object_paths: cleanedPaths });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new AppError("INTERNAL_ERROR", "Produk tidak dapat dihapus.", { cause: error });
  const result = data as Record<string, unknown>;
  return { id: productId, sellerId, slug: typeof result.slug === "string" ? result.slug : "" };
}
