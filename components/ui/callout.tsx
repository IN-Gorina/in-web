import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

type Tone = "info" | "warning" | "success" | "danger" | "neutral";

const tones: Record<Tone, { box: string; icon: string; title: string; body: string; defaultIcon: IconName }> = {
  info: { box: "bg-blue-tint", icon: "text-elite-blue", title: "text-ink", body: "text-deep-blue", defaultIcon: "info" },
  warning: { box: "bg-warning-soft", icon: "text-warning", title: "text-ink", body: "text-warning-strong", defaultIcon: "alert" },
  success: { box: "bg-success-soft", icon: "text-success", title: "text-success", body: "text-success", defaultIcon: "check" },
  danger: { box: "bg-danger-soft", icon: "text-danger", title: "text-ink", body: "text-danger", defaultIcon: "alert" },
  neutral: { box: "bg-surface-muted", icon: "text-ink-muted", title: "text-ink", body: "text-ink-muted", defaultIcon: "info" },
};

/** Inline message: a one-liner ("Cuando el socio paga en el club…") or a title with a body (conflict warnings). */
export function Callout({
  tone = "info",
  title,
  children,
  icon,
  className,
}: {
  tone?: Tone;
  title?: ReactNode;
  children?: ReactNode;
  icon?: IconName;
  className?: string;
}) {
  const style = tones[tone];
  return (
    <div className={cn("flex gap-2.5 rounded-md px-4 py-3", title ? "items-start" : "items-center", style.box, className)}>
      <Icon name={icon ?? style.defaultIcon} size={18} className={cn(style.icon, title ? "mt-px" : null)} />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        {title && <p className={cn("text-label font-bold leading-[18px]", style.title)}>{title}</p>}
        {children && (
          <div className={cn(title ? "text-caption font-medium" : "text-body-sm font-semibold", title ? style.body : "text-ink")}>
            {children}
          </div>
        )}
      </div>
    </div>
  );
}
