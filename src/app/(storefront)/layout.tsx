import { CartProvider } from "@/contexts/cart-context";

export default function StorefrontLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <CartProvider>{children}</CartProvider>;
}
