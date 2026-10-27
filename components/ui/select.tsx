"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon } from "./icon";
import { Menu } from "./menu";

export type SelectOption<T extends string> = { value: T; label: string };

/**
 * Dropdown picker.
 * - "toolbar": white bordered trigger in page filters ("Estado", "Todas las canchas").
 * - "field": filled 44px trigger inside forms ("Tipo", "Al tocarla abre").
 */
export function Select<T extends string>({
  options,
  value,
  onChange,
  label,
  placeholder,
  valueLabel,
  variant = "toolbar",
  icon,
  width,
  className,
}: {
  options: readonly SelectOption<T>[];
  value: T | null;
  onChange: (value: T) => void;
  /** Accessible name. In the toolbar it is also the text shown while nothing is picked. */
  label: string;
  placeholder?: string;
  /** Trigger text for the picked option when it differs from its menu label ("Este mes" → "1 oct – 8 oct"). */
  valueLabel?: string;
  variant?: "toolbar" | "field";
  icon?: ReactNode;
  width?: number;
  className?: string;
}) {
  const selected = options.find((option) => option.value === value);
  const text = (selected && valueLabel) ?? selected?.label ?? placeholder ?? label;

  return (
    <Menu
      placement="bottom-start"
      width={width ?? 240}
      className={cn(variant === "field" && "w-full", className)}
      items={options.map((option) => ({
        label: option.label,
        checked: option.value === value,
        onSelect: () => onChange(option.value),
      }))}
      trigger={(props) => (
        <button
          type="button"
          aria-label={`${label}: ${text}`}
          {...props}
          className={cn(
            "flex shrink-0 items-center whitespace-nowrap transition-colors",
            // Paper: 8px around a leading icon ("1 oct – 8 oct"), 6px otherwise.
            icon ? "gap-2" : "gap-1.5",
            variant === "toolbar" &&
              "h-10 rounded-control border border-line bg-white px-3 text-body-sm font-semibold text-ink hover:bg-field",
            variant === "field" &&
              "h-11 w-full justify-between rounded-control bg-field px-3.5 text-label font-semibold hover:bg-blue-tint",
            variant === "field" && !selected && "text-ink-disabled",
          )}
        >
          {icon}
          <span className={cn(variant === "field" && "truncate")}>{text}</span>
          <Icon name="chevron-down" size={14} strokeWidth={2.5} className="text-ink-muted" />
        </button>
      )}
    />
  );
}
