import { requireAdmin } from "@/lib/auth/require-admin";
import { AdminShell } from "@/components/admin/admin-shell";
import { getCurrentSeller } from "@/server/data/seller";

export default async function ProtectedAdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  await requireAdmin();
  const seller = await getCurrentSeller();
  return <AdminShell storeName={seller.store_name}>{children}</AdminShell>;
}
