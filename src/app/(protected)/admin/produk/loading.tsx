import { Skeleton } from "@/components/ui/skeleton";

export default function AdminProductsLoading() {
  return (
    <main className="px-gutter py-8" aria-busy="true">
      <div className="border-b border-border pb-6">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="mt-2 h-5 w-72 max-w-full" />
      </div>
      <div className="mt-6 rounded-lg border border-border bg-surface p-3">
        <Skeleton className="h-8 w-full" />
        <div className="mt-3 grid gap-2">
          {Array.from({ length: 6 }).map((_, index) => (
            <Skeleton key={index} className="h-9 w-full" />
          ))}
        </div>
      </div>
    </main>
  );
}
