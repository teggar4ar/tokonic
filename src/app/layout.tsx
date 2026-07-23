import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Tokonic",
  description: "Toko online mandiri untuk UMKM",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
