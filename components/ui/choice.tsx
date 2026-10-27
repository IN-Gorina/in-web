import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { CountBadge } from "./badge";
import { Icon, type IconName } from "./icon";

export type Option<T extends string> = { value: T; label: ReactNode; count?: number; disabled?: boolean };

/**
 * Segmented tabs.
 * - "toolbar": white bordered group with a blue selected tab (Hoy / Semana / Mes, Próximos / Borradores).
 * - "field": filled group with a white selected tab, used inside forms (60′ / 90′, Socio / Invitado).
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  variant = "toolbar",
  size = "md",
  label,
  className,
}: {
  options: readonly Option<T>[];
  value: T;
  onChange: (value: T) => void;
  variant?: "toolbar" | "field";
  size?: "sm" | "md";
  label: string;
  className?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn(
        "flex shrink-0",
        variant === "toolbar" && "gap-0.5 rounded-control border border-line bg-white p-[3px]",
        variant === "field" && (size === "sm" ? "h-[30px] rounded-sm bg-field p-[3px]" : "h-11 rounded-control bg-field p-1"),
        className,
      )}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex items-center justify-center gap-1.5 whitespace-nowrap font-semibold transition-colors",
              variant === "toolbar" && "h-8 rounded-[7px] px-3 text-body-sm",
              variant === "toolbar" && (selected ? "bg-elite-blue text-white" : "text-ink-muted hover:text-ink"),
              variant === "field" && "flex-1 font-bold",
              variant === "field" && (size === "sm" ? "rounded-[6px] px-2.5 text-caption" : "rounded-sm px-3 text-body-sm"),
              variant === "field" && (selected ? "bg-white text-ink" : "text-ink-muted hover:text-ink"),
            )}
          >
            {option.label}
            {option.count !== undefined &&
              (selected && variant === "toolbar" ? (
                <CountBadge count={option.count} tone="on-primary" />
              ) : (
                <span className="text-micro font-bold text-ink-disabled">{option.count}</span>
              ))}
          </button>
        );
      })}
    </div>
  );
}

/** Rounded pill chips (Motivo, ¿A quién?). The selected chip is ink, or blue with `tone="blue"`. */
export function ChipGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  tone = "ink",
}: {
  options: readonly Option<T>[];
  value: T | null;
  onChange: (value: T) => void;
  label: string;
  tone?: "ink" | "blue";
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-9 items-center rounded-full px-3.5 text-body-sm font-bold transition-colors",
              selected
                ? tone === "ink"
                  ? "bg-ink text-white"
                  : "bg-elite-blue text-white"
                : "border-[1.5px] border-line text-ink hover:bg-field",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Equal-width tiles (C1…C6, Lun…Dom, 8ª…1ª). Supports picking several with `multiple`. */
export function TileGroup<T extends string>({
  options,
  value,
  onChange,
  label,
  display = false,
}: {
  options: readonly Option<T>[];
  value: readonly T[];
  onChange: (value: T) => void;
  label: string;
  /** Viga numerals, for categories. */
  display?: boolean;
}) {
  return (
    <div role="group" aria-label={label} className="flex gap-1.5">
      {options.map((option) => {
        const selected = value.includes(option.value);
        return (
          <button
            key={option.value}
            type="button"
            aria-pressed={selected}
            disabled={option.disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-10 flex-1 items-center justify-center rounded-control transition-colors disabled:cursor-not-allowed disabled:text-switch-off",
              display ? "font-display text-body" : "text-body-sm font-bold",
              selected ? "bg-elite-blue text-white" : "bg-field text-ink enabled:hover:bg-blue-tint",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

/** Large selectable card with a title and description ("Paga todo en el club", roles, payment method). */
export function ChoiceCard({
  title,
  description,
  selected,
  onSelect,
  indicator = "none",
  icon,
  children,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  selected: boolean;
  onSelect: () => void;
  indicator?: "none" | "radio" | "checkbox";
  icon?: IconName;
  /** Extra controls shown inside the card (only when selected, by convention). */
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 rounded-md border-2 px-3.5 py-3 transition-colors",
        selected ? "border-elite-blue bg-blue-tint" : "border-line bg-white hover:bg-surface-muted",
        className,
      )}
    >
      <button
        type="button"
        role={indicator === "checkbox" ? "checkbox" : "radio"}
        aria-checked={selected}
        onClick={onSelect}
        className={cn("flex w-full gap-3 text-left", icon ? "flex-col gap-1.5" : "items-center")}
      >
        {indicator === "radio" && (
          <span
            aria-hidden
            className={cn(
              "size-5 shrink-0 rounded-full bg-white",
              selected ? "border-[6px] border-elite-blue" : "border-2 border-ink-disabled",
            )}
          />
        )}
        {indicator === "checkbox" && (
          <span
            aria-hidden
            className={cn(
              "flex size-5 shrink-0 items-center justify-center rounded-[6px]",
              selected ? "bg-elite-blue text-white" : "border-2 border-ink-disabled bg-white",
            )}
          >
            {selected && <Icon name="check" size={12} strokeWidth={4} />}
          </span>
        )}
        {icon && <Icon name={icon} size={20} className={selected ? "text-elite-blue" : "text-ink-muted"} />}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-label font-bold leading-[18px] text-ink">{title}</span>
          {description && <span className="text-caption font-medium text-ink-muted">{description}</span>}
        </span>
      </button>
      {children}
    </div>
  );
}

/** On/off switch (40×24). */
export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "flex h-6 w-10 shrink-0 rounded-full p-[3px] transition-colors disabled:opacity-50",
        checked ? "justify-end bg-elite-blue" : "justify-start bg-switch-off",
      )}
    >
      <span className="size-[18px] rounded-full bg-white shadow-sm" />
    </button>
  );
}

/** Filled row with a title, description and a switch ("Repetir cada semana"). */
export function SwitchRow({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: ReactNode;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-md bg-field p-3.5">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-label font-bold leading-[18px] text-ink">{title}</p>
        {description && <p className="text-caption font-medium text-ink-muted">{description}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} label={title} />
    </div>
  );
}
