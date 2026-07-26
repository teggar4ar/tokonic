import Link from "next/link";

import { CartLink } from "@/components/storefront/cart-link";

export function StorefrontHeader({ storeName }: { storeName: string }) {
  return (
    <header className="sticky top-0 z-10 border-b border-border bg-background/95 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="rounded-md text-lg font-semibold tracking-tight text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          {storeName}
        </Link>
        <CartLink />
      </div>
    </header>
  );
}
