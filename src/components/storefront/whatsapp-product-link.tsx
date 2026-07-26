import { ChatBubbleLeftRightIcon } from "@heroicons/react/24/outline";

import { buildWhatsAppProductUrl } from "@/lib/whatsapp";

type WhatsAppProductLinkProps = {
  whatsappPhone: string | null;
  productName: string;
  productSlug: string;
};

export function WhatsAppProductLink({
  whatsappPhone,
  productName,
  productSlug,
}: WhatsAppProductLinkProps) {
  if (whatsappPhone === null) {
    return null;
  }

  const url = buildWhatsAppProductUrl({ whatsappPhone, productName, productSlug });

  if (url === null) {
    return null;
  }

  return (
    <div className="border-t border-border pt-4">
      <p className="text-sm text-muted-foreground">Masih ragu atau ada pertanyaan sebelum membeli?</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 inline-flex h-control items-center gap-2 rounded-lg border border-border px-4 text-sm font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
      >
        <ChatBubbleLeftRightIcon aria-hidden="true" className="size-5" />
        Tanya penjual via WhatsApp
      </a>
    </div>
  );
}
