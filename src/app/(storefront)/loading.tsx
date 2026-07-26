import { Skeleton } from "@/components/ui/skeleton";

export default function StorefrontLoading() {
  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="pb-8">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-3 h-5 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-x-4 gap-y-8 sm:gap-x-6 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index}>
            <Skeleton className="aspect-square w-full rounded-xl" />
            <Skeleton className="mt-3 h-5 w-3/4" />
            <Skeleton className="mt-2 h-6 w-1/2" />
          </div>
        ))}
      </div>
    </main>
  );
}
