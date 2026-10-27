import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

/*
 * Panel tables are flex rows with fixed-width columns, so cells line up across rows the
 * same way they do in Paper. Give every cell the same `width` as its header (or `grow`).
 */

type CellLayout = {
  /** Fixed column width in px. Omit and pass `grow` for the flexible column. */
  width?: number;
  grow?: boolean;
  align?: "left" | "right" | "center";
};

function layout({ width, grow, align }: CellLayout) {
  return {
    style: width ? { width } : undefined,
    className: cn(
      "flex min-w-0 flex-col justify-center gap-0.5",
      width ? "shrink-0" : grow ? "flex-1" : "shrink-0",
      align === "right" && "items-end text-right",
      align === "center" && "items-center text-center",
    ),
  };
}

export function Table({ children, label, className }: { children: ReactNode; label: string; className?: string }) {
  return (
    <div
      role="table"
      aria-label={label}
      className={cn("flex flex-col rounded-card border border-line bg-white", className)}
    >
      {children}
    </div>
  );
}

export function TableHeader({ children }: { children: ReactNode }) {
  return (
    <div role="rowgroup">
      <div role="row" className="flex h-11 shrink-0 items-center gap-4 rounded-t-card border-b border-line bg-surface-muted px-5">
        {children}
      </div>
    </div>
  );
}

export function TableHeaderCell({ children, ...cell }: CellLayout & { children?: ReactNode }) {
  const { style, className } = layout(cell);
  return (
    <div role="columnheader" style={style} className={className}>
      <span className="text-caption font-bold uppercase tracking-label text-ink-muted">{children}</span>
    </div>
  );
}

export function TableBody({ children }: { children: ReactNode }) {
  return (
    <div role="rowgroup" className="flex flex-col">
      {children}
    </div>
  );
}

export function TableRow({
  children,
  selected,
  height = 60,
  onClick,
}: {
  children: ReactNode;
  selected?: boolean;
  height?: number;
  onClick?: () => void;
}) {
  return (
    <div
      role="row"
      aria-selected={selected || undefined}
      onClick={onClick}
      style={{ height }}
      className={cn(
        "flex shrink-0 items-center gap-4 border-b border-line px-5 last:rounded-b-card last:border-b-0",
        selected ? "bg-field" : onClick && "cursor-pointer hover:bg-surface-muted",
      )}
    >
      {children}
    </div>
  );
}

export function TableCell({
  children,
  primary,
  secondary,
  tone = "default",
  weight = "medium",
  ...cell
}: CellLayout & {
  children?: ReactNode;
  /** Shorthand for a main line + muted second line ("Jue 8 · 19:00" / "Cancha 1 · 90 min"). */
  primary?: ReactNode;
  secondary?: ReactNode;
  tone?: "default" | "muted" | "danger";
  weight?: "medium" | "semibold" | "bold";
}) {
  const { style, className } = layout(cell);
  return (
    <div role="cell" style={style} className={className}>
      {primary !== undefined ? (
        <>
          <span className="truncate text-label font-bold leading-[18px] text-ink">{primary}</span>
          {secondary && <span className="truncate text-caption font-medium text-ink-muted">{secondary}</span>}
        </>
      ) : typeof children === "string" || typeof children === "number" ? (
        <span
          className={cn(
            "truncate text-label",
            weight === "medium" && "font-medium",
            weight === "semibold" && "font-semibold",
            weight === "bold" && "font-bold",
            tone === "default" && "text-ink",
            tone === "muted" && "text-ink-muted",
            tone === "danger" && "text-danger",
          )}
        >
          {children}
        </span>
      ) : (
        <div className="flex">{children}</div>
      )}
    </div>
  );
}

/** Footer inside a table card ("Mostrando 1–10 de 1.284 socios" + pagination or a link). */
export function TableFooter({ children }: { children: ReactNode }) {
  return (
    <div className="mt-auto flex h-[52px] shrink-0 items-center justify-between gap-4 border-t border-line px-5 text-body-sm font-medium text-ink-muted">
      {children}
    </div>
  );
}
