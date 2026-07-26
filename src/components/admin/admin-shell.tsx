import { ArrowRightStartOnRectangleIcon } from "@heroicons/react/24/outline";
import { logout } from "@/actions/auth";
import { AdminNav } from "@/components/admin/admin-nav";

type AdminShellProps = {
  storeName: string;
  children: React.ReactNode;
};

function LogoutButton() {
  return (
    <form action={logout}>
      <button
        type="submit"
        className="flex h-control items-center gap-2 rounded-md px-3 text-sm font-semibold text-primary-foreground/70 transition-colors hover:bg-primary-foreground/10 hover:text-primary-foreground"
      >
        <ArrowRightStartOnRectangleIcon className="size-5" aria-hidden="true" />
        Keluar
      </button>
    </form>
  );
}

export function AdminShell({ storeName, children }: AdminShellProps) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <div className="bg-primary text-primary-foreground lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:gap-6 lg:overflow-y-auto lg:px-4 lg:py-6">
        <div className="flex items-center justify-between gap-4 px-4 py-3 lg:block lg:p-0">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary-foreground/60">Tokonic Admin</p>
            <p className="truncate text-base font-bold">{storeName}</p>
          </div>
          <div className="lg:hidden">
            <LogoutButton />
          </div>
        </div>
        <div className="px-4 pb-2 lg:flex-1 lg:p-0">
          <AdminNav />
        </div>
        <div className="hidden lg:block">
          <LogoutButton />
        </div>
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
