"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArchiveBoxIcon, Cog6ToothIcon, Squares2X2Icon } from "@heroicons/react/24/outline";
import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dasbor", icon: Squares2X2Icon, exact: true },
  { href: "/admin/produk", label: "Produk", icon: ArchiveBoxIcon, exact: false },
  { href: "/admin/pengaturan", label: "Pengaturan toko", icon: Cog6ToothIcon, exact: false },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav aria-label="Navigasi admin" className="-mx-2 lg:mx-0">
      <ul className="flex gap-1 overflow-x-auto px-2 lg:flex-col lg:px-0">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);

          return (
            <li key={href} className="shrink-0">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-control items-center gap-2 whitespace-nowrap rounded-md px-3 text-sm font-semibold transition-colors",
                  active
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "text-primary-foreground/70 hover:bg-primary-foreground/10 hover:text-primary-foreground",
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
