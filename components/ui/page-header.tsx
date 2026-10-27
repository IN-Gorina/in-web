import Link from "next/link";
import type { ReactNode } from "react";

import { Icon } from "./icon";

/** Title, subtitle and page actions at the top of every panel screen. */
export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: string;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Breadcrumb back link, e.g. { href: "/socios", label: "Socios" }. */
  back?: { href: string; label: string };
}) {
  return (
    <header className="flex shrink-0 flex-col gap-4">
      {back && (
        <Link
          href={back.href}
          className="inline-flex items-center gap-1.5 self-start text-body-sm font-semibold text-ink-muted hover:text-ink"
        >
          <Icon name="chevron-left" size={14} strokeWidth={2.4} />
          {back.label}
        </Link>
      )}
      <div className="flex min-h-[54px] items-center justify-between gap-6">
        <div className="flex min-w-0 flex-col gap-0.5">
          <h1 className="font-display text-title-1 tracking-tight text-ink">{title}</h1>
          {subtitle && <p className="text-label font-medium text-ink-muted">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
      </div>
    </header>
  );
}
