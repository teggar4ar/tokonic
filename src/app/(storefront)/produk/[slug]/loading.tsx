import { Skeleton } from "@/components/ui/skeleton";

export default function ProductDetailLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="pb-6">
        <Skeleton className="h-5 w-40" />
      </div>
      <div className="grid gap-8 md:grid-cols-2 lg:gap-12">
        <div>
          <Skeleton className="aspect-square w-full rounded-xl" />
          <div className="mt-3 flex gap-2">
            <Skeleton className="size-11 rounded-lg" />
            <Skeleton className="size-11 rounded-lg" />
            <Skeleton className="size-11 rounded-lg" />
          </div>
        </div>
        <div className="grid content-start gap-6">
          <div>
            <Skeleton className="h-9 w-3/4" />
            <Skeleton className="mt-3 h-8 w-40" />
            <Skeleton className="mt-2 h-5 w-28" />
          </div>
          <div>
            <Skeleton className="h-5 w-16" />
            <Skeleton className="mt-2 h-11 w-40 rounded-lg" />
            <Skeleton className="mt-3 h-11 w-full rounded-lg sm:w-56" />
          </div>
          <div className="border-t border-border pt-6">
            <Skeleton className="h-6 w-44" />
            <Skeleton className="mt-3 h-5 w-full" />
            <Skeleton className="mt-2 h-5 w-5/6" />
          </div>
        </div>
      </div>
    </main>
  );
}
