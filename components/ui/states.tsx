import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

/** Shown when a list has nothing to show. Keep the copy short and say what to do next. */
export function EmptyState({
  icon = "info",
  title,
  description,
  action,
  className,
}: {
  icon?: IconName;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 px-6 py-16 text-center", className)}>
      <span className="flex size-12 items-center justify-center rounded-md bg-field text-elite-blue">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-display text-title-3 text-ink">{title}</p>
        {description && <p className="text-label font-medium text-ink-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Shown when loading a list fails. */
export function ErrorState({ title = "No pudimos cargar esto", description, action }: { title?: string; description?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <span className="flex size-12 items-center justify-center rounded-md bg-danger-soft text-danger">
        <Icon name="alert" size={22} />
      </span>
      <div className="flex max-w-sm flex-col gap-1">
        <p className="font-display text-title-3 text-ink">{title}</p>
        <p className="text-label font-medium text-ink-muted">
          {description ?? "Revisá tu conexión y probá de nuevo."}
        </p>
      </div>
      {action}
    </div>
  );
}

/** Gray block that stands in for content while it loads. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden className={cn("animate-pulse rounded-sm bg-field", className)} />;
}

/** Placeholder rows for a table while it loads. */
export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div role="status" aria-label="Cargando" className="flex flex-col">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex h-[60px] items-center gap-4 border-b border-line px-5 last:border-b-0">
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-4 flex-1" />
          <Skeleton className="h-6 w-28 rounded-full" />
        </div>
      ))}
    </div>
  );
}
