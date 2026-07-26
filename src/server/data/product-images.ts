import "server-only";

import { requireAdmin } from "../../lib/auth/require-admin";
import { createClient } from "../../lib/supabase/server";
import type { ProductImageMetadataInput } from "../../lib/validation/product-images";
import { productImageBucket } from "../../lib/validation/product-images";
import { AppError } from "../errors/app-error";
import { inspectStoredImage } from "../images/stored-image-inspector";
import { isConfirmedStorageNotFound } from "../storage/storage-absence";

async function authorizedClient(sellerId: string) {
  const admin = await requireAdmin();
  if (admin.sellerId !== sellerId) throw new AppError("FORBIDDEN", "Akses gambar ditolak.");
  return createClient();
}

function extensionOf(path: string) {
  return path.split(".").pop() ?? "";
}

export async function assertOwnedProduct(sellerId: string, productId: string) {
  const supabase = await authorizedClient(sellerId);
  const { data, error } = await supabase.from("products").select("id").eq("id", productId).eq("seller_id", sellerId).maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Produk tidak dapat diverifikasi.", { cause: error });
  if (!data) throw new AppError("NOT_FOUND", "Produk tidak ditemukan.");
}

export async function countOwnedProductImages(sellerId: string, productId: string) {
  const supabase = await authorizedClient(sellerId);
  const { count, error } = await supabase.from("product_images").select("id", { count: "exact", head: true }).eq("product_id", productId);
  if (error) throw new AppError("INTERNAL_ERROR", "Jumlah gambar tidak dapat diperiksa.", { cause: error });
  return count ?? 0;
}

export async function getOwnedProductImage(sellerId: string, imageId: string) {
  const supabase = await authorizedClient(sellerId);
  const { data, error } = await supabase.from("product_images").select("id, product_id, bucket, object_path, mime_type, byte_size, width, height, display_order, products!inner(seller_id)").eq("id", imageId).eq("products.seller_id", sellerId).maybeSingle();
  if (error) throw new AppError("INTERNAL_ERROR", "Gambar tidak dapat dimuat.", { cause: error });
  if (!data) throw new AppError("NOT_FOUND", "Gambar tidak ditemukan.");
  return { id: data.id, sellerId, productId: data.product_id, bucket: data.bucket, objectPath: data.object_path, mimeType: data.mime_type, byteSize: data.byte_size, width: data.width, height: data.height, displayOrder: data.display_order };
}

export async function verifyOwnedStorageObject(sellerId: string, bucket: string, objectPath: string) {
  const supabase = await authorizedClient(sellerId);
  if (bucket !== productImageBucket) throw new AppError("VALIDATION_ERROR", "Bucket gambar tidak valid.");
  const { data, error } = await supabase.storage.from(bucket).download(objectPath);
  if (error) {
    if (isConfirmedStorageNotFound(error)) return { exists: false, candidateIdentified: false };
    throw new AppError("INTERNAL_ERROR", "Objek gambar tidak dapat diverifikasi.", { cause: error });
  }
  if (!data) throw new AppError("INTERNAL_ERROR", "Objek gambar tidak dapat diverifikasi.");
  const bytes = new Uint8Array(await data.arrayBuffer());
  const declaredMimeType = data.type;
  try {
    const inspected = await inspectStoredImage({ bytes, storageContentType: declaredMimeType, extension: extensionOf(objectPath) });
    return { exists: true, candidateIdentified: true, contentType: declaredMimeType, actualMimeType: inspected.mimeType, byteSize: inspected.byteSize, width: inspected.width, height: inspected.height };
  } catch (error) {
    throw new AppError("VALIDATION_ERROR", "Objek gambar tidak valid.", { cause: { candidateIdentified: true, error } });
  }
}

export async function insertProductImageMetadata(sellerId: string, input: ProductImageMetadataInput) {
  const supabase = await authorizedClient(sellerId);
  const { data, error } = await supabase.rpc("register_product_image", {
    p_product_id: input.productId,
    p_bucket: productImageBucket,
    p_object_path: input.objectPath,
    p_mime_type: input.mimeType,
    p_byte_size: input.byteSize,
    p_width: input.width,
    p_height: input.height,
    p_display_order: input.displayOrder,
  });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new AppError(error?.code === "23505" || error?.code === "23514" || error?.code === "40001" ? "CONFLICT" : "INTERNAL_ERROR", "Metadata gambar tidak dapat disimpan.", { cause: error });
  const row = data as Record<string, unknown>;
  return { id: String(row.id), productId: String(row.product_id), objectPath: String(row.object_path), mimeType: String(row.mime_type), byteSize: Number(row.byte_size), width: Number(row.width), height: Number(row.height), displayOrder: Number(row.display_order) };
}

export async function updateProductImageMetadata(sellerId: string, imageId: string, input: ProductImageMetadataInput) {
  const supabase = await authorizedClient(sellerId);
  const { data, error } = await supabase.rpc("replace_product_image", { p_image_id: imageId, p_object_path: input.objectPath, p_mime_type: input.mimeType, p_byte_size: input.byteSize, p_width: input.width, p_height: input.height });
  if (error || !data || typeof data !== "object" || Array.isArray(data)) throw new AppError(error?.code === "P0002" ? "NOT_FOUND" : error?.code === "40001" ? "CONFLICT" : "INTERNAL_ERROR", "Metadata gambar tidak dapat diperbarui.", { cause: error });
  const row = data as Record<string, unknown>;
  return { id: String(row.id), productId: String(row.product_id), objectPath: String(row.object_path), mimeType: String(row.mime_type), byteSize: Number(row.byte_size), width: Number(row.width), height: Number(row.height), displayOrder: Number(row.display_order) };
}

export async function deleteProductImageMetadata(sellerId: string, imageId: string) {
  const supabase = await authorizedClient(sellerId);
  const { data, error } = await supabase.rpc("delete_product_image", { p_image_id: imageId });
  if (error || !data) throw new AppError(error?.code === "P0002" ? "NOT_FOUND" : error?.code === "40001" ? "CONFLICT" : "INTERNAL_ERROR", "Metadata gambar tidak dapat dihapus.", { cause: error });
}

export async function removeOwnedStorageObjects(sellerId: string, bucket: string, paths: string[]) {
  const supabase = await authorizedClient(sellerId);
  if (bucket !== productImageBucket) throw new AppError("VALIDATION_ERROR", "Bucket gambar tidak valid.");
  if (paths.length === 0) return { removed: [], notFound: [] };
  const { data, error } = await supabase.storage.from(bucket).remove(paths);
  if (error) throw new AppError("INTERNAL_ERROR", "Objek gambar tidak dapat dihapus.", { cause: error });
  const removed = data.map((object) => object.name).filter((path) => paths.includes(path));
  const unresolved: string[] = [];
  for (const path of paths.filter((path) => !removed.includes(path))) {
    const result = await supabase.storage.from(bucket).download(path);
    if (!result.error || !isConfirmedStorageNotFound(result.error)) unresolved.push(path);
  }
  if (unresolved.length > 0) throw new AppError("INTERNAL_ERROR", "Penghapusan objek gambar belum lengkap.");
  return { removed, notFound: paths.filter((path) => !removed.includes(path)) };
}
