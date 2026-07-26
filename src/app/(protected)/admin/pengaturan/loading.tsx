import { Skeleton } from "@/components/ui/skeleton";

export default function AdminSettingsLoading() {
  return (
    <main className="px-gutter py-8" aria-busy="true">
      <div className="border-b border-border pb-6">
        <Skeleton className="h-8 w-52" />
        <Skeleton className="mt-2 h-5 w-80 max-w-full" />
      </div>
      <div className="mt-6 grid max-w-3xl gap-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="grid gap-2">
            <Skeleton className="h-5 w-36" />
            <Skeleton className="h-control w-full" />
          </div>
        ))}
      </div>
    </main>
  );
}
