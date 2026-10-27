"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/cn";

import { CountBadge } from "../ui/badge";
import { Icon } from "../ui/icon";
import { isActive, type NavSection } from "./nav";

/** Nav items with the active state. Rendered inside <Suspense> because it reads the pathname. */
export function NavLinks({ sections, counts }: { sections: NavSection[]; counts: Record<string, number> }) {
  const pathname = usePathname();
  return <NavList sections={sections} counts={counts} pathname={pathname} />;
}

/** Same list without an active item, used as the Suspense fallback. */
export function NavList({
  sections,
  counts,
  pathname = null,
}: {
  sections: NavSection[];
  counts: Record<string, number>;
  pathname?: string | null;
}) {
  return (
    <nav aria-label="Panel" className="flex flex-1 flex-col gap-0.5">
      {sections.map((section) => (
        <div key={section.title} className="flex flex-col gap-0.5">
          <p className="px-3 pb-1.5 pt-3.5 text-micro font-bold uppercase tracking-eyebrow text-ink-disabled">
            {section.title}
          </p>
          {section.items.map((item) => {
            const active = pathname !== null && isActive(item.href, pathname);
            const count = item.badge ? counts[item.badge] : 0;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 shrink-0 items-center gap-3 rounded-control pl-3 pr-2.5 text-label transition-colors",
                  active ? "bg-blue-tint font-bold text-elite-blue" : "font-semibold text-ink-muted hover:bg-surface-muted hover:text-ink",
                )}
              >
                <Icon name={item.icon} size={20} />
                <span className="min-w-0 flex-1 whitespace-nowrap">{item.label}</span>
                {count ? <CountBadge count={count} /> : null}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
