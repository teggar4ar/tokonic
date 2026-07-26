import { publicEnv } from "./env/public";
import { productImageBucket } from "./validation/product-images";

export function publicProductImageUrl(objectPath: string) {
  return `${publicEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${productImageBucket}/${objectPath}`;
}
