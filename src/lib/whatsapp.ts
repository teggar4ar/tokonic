import { productSlugSchema } from "./validation/products";

const internationalPhonePattern = /^[1-9][0-9]{7,14}$/;

type WhatsAppProductContext = {
  whatsappPhone: string;
  productName: string;
  productSlug: string;
};

export function buildWhatsAppProductUrl({
  whatsappPhone,
  productName,
  productSlug,
}: WhatsAppProductContext) {
  if (!internationalPhonePattern.test(whatsappPhone)) {
    return null;
  }

  const parsedSlug = productSlugSchema.safeParse(productSlug);

  if (!parsedSlug.success) {
    return null;
  }

  const url = new URL(`https://wa.me/${whatsappPhone}`);
  url.searchParams.set(
    "text",
    `Halo, saya ingin bertanya tentang produk "${productName}" (/produk/${parsedSlug.data}).`,
  );

  return url.toString();
}
