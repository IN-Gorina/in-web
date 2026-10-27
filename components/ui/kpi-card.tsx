import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

type Trend = "positive" | "warning" | "neutral";

const trendColors: Record<Trend, string> = {
  positive: "text-success",
  warning: "text-warning",
  neutral: "text-ink-muted",
};

/**
 * Number tile at the top of Resumen, Agenda and Pagos. `highlight` is the blue tile
 * (one per row at most); its footnote turns lime.
 */
export function KpiCard({
  label,
  value,
  footnote,
  trend = "neutral",
  highlight = false,
}: {
  label: string;
  value: string;
  footnote?: string;
  trend?: Trend;
  highlight?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-1 flex-col gap-1.5 rounded-card p-[18px]",
        highlight ? "bg-elite-blue" : "border border-line bg-white",
      )}
    >
      <p className={cn("text-body-sm font-semibold", highlight ? "text-blue-tint" : "text-ink-muted")}>{label}</p>
      <p className={cn("font-display text-kpi", highlight ? "text-white" : "text-ink")}>{value}</p>
      {footnote && (
        <p className={cn("text-caption font-semibold", highlight ? "text-energy-lime" : trendColors[trend])}>
          {footnote}
        </p>
      )}
    </div>
  );
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="flex gap-4">{children}</div>;
}
