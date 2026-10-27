import { Skeleton } from "../ui/states";

/** Placeholder for a panel page while its data (and the session check) streams in. */
export function PageSkeleton() {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-96" />
      </div>
      <Skeleton className="h-[420px] w-full rounded-lg" />
    </div>
  );
}
