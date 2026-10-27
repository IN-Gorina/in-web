import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export type BadgeTone = "success" | "warning" | "danger" | "info" | "neutral" | "dark";

const tones: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-danger-soft text-danger",
  info: "bg-blue-tint text-elite-blue",
  neutral: "bg-surface-muted text-ink-muted border border-line",
  dark: "bg-ink text-white",
};

/** Status pill used in tables and headers ("Confirmada · seña", "Activo", "Sin acceso"). */
export function Badge({ tone, children, className }: { tone: BadgeTone; children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-[26px] shrink-0 items-center whitespace-nowrap rounded-full px-2.5 text-caption font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Red count next to a nav item or a tab ("2", "3"). */
export function CountBadge({ count, tone = "danger" }: { count: number; tone?: "danger" | "warning" | "on-primary" }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-5 shrink-0 items-center justify-center rounded-full px-[7px] py-px text-micro font-bold leading-4",
        tone === "danger" && "bg-danger text-white",
        tone === "warning" && "bg-warning-soft text-warning",
        tone === "on-primary" && "bg-white text-elite-blue",
      )}
    >
      {count}
    </span>
  );
}
