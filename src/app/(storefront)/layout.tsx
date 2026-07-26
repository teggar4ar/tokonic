import { StorefrontHeader } from "@/components/storefront/storefront-header";
import { CartProvider } from "@/contexts/cart-context";
import { getPublicStoreProfile } from "@/server/data/seller";

export default async function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const profile = await getPublicStoreProfile();
  const storeName = profile?.storeName ?? "Tokonic";

  return (
    <CartProvider>
      <StorefrontHeader storeName={storeName} />
      {children}
    </CartProvider>
  );
}
