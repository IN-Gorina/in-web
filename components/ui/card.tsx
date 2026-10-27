import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/** White surface with the panel's 1px line border. */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <section className={cn("rounded-card border border-line bg-white", className)}>{children}</section>;
}

/** Card heading in Viga ("Ocupación por franja", "Equipo") with an optional trailing slot. */
export function CardTitle({ title, aside, className }: { title: string; aside?: ReactNode; className?: string }) {
  return (
    <div className={cn("flex items-center justify-between gap-4", className)}>
      <h2 className="font-display text-title-card text-ink">{title}</h2>
      {aside && <div className="text-body-sm font-semibold text-ink-muted">{aside}</div>}
    </div>
  );
}

/** Small uppercase label above a group ("PEDIDOS DESDE LA APP", "HISTORIAL"). */
export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <p className={cn("text-micro font-bold uppercase tracking-eyebrow text-ink-muted", className)}>{children}</p>
  );
}
