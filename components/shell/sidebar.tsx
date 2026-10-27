import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";

import { can } from "@/lib/auth/permissions";
import { getAttentionCounts } from "@/lib/data/attention/service";
import type { StaffMember } from "@/lib/data/types";
import { isFirebaseEnabled } from "@/lib/firebase/config";

import { Badge } from "../ui/badge";
import { Skeleton } from "../ui/states";
import { AccountMenu } from "./account-menu";
import { navSections } from "./nav";
import { NavLinks, NavList } from "./nav-links";

export async function Sidebar({ staff }: { staff: StaffMember }) {
  const counts = await getAttentionCounts();
  const sections = navSections
    .map((section) => ({
      ...section,
      items: section.items.filter((item) => !item.permission || can(staff.role, item.permission)),
    }))
    .filter((section) => section.items.length > 0);

  return (
    <aside className="flex h-full w-[248px] shrink-0 flex-col gap-7 border-r border-line bg-white px-4 py-6">
      <Link href="/" className="flex items-center gap-3 px-2">
        <Image src="/brand/in-gorina-blue.png" alt="" width={35} height={40} priority />
        <span className="flex flex-col">
          <span className="font-display text-[17px] leading-[22px] text-ink">IN Gorina</span>
          <span className="text-caption font-medium text-ink-muted">Panel del club</span>
        </span>
      </Link>

      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
        <Suspense fallback={<NavList sections={sections} counts={counts} />}>
          <NavLinks sections={sections} counts={counts} />
        </Suspense>
      </div>

      {!isFirebaseEnabled && (
        <Badge tone="warning" className="self-start">
          Modo sin Firebase
        </Badge>
      )}
      <AccountMenu name={staff.name} email={staff.email} role={staff.role} />
    </aside>
  );
}

/** Same frame as the sidebar while the session loads. */
export function SidebarSkeleton() {
  return (
    <aside aria-hidden className="flex h-full w-[248px] shrink-0 flex-col gap-7 border-r border-line bg-white px-4 py-6">
      <div className="flex items-center gap-3 px-2">
        <Image src="/brand/in-gorina-blue.png" alt="" width={35} height={40} priority />
        <span className="flex flex-col">
          <span className="font-display text-[17px] leading-[22px] text-ink">IN Gorina</span>
          <span className="text-caption font-medium text-ink-muted">Panel del club</span>
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-3 px-2">
        {Array.from({ length: 8 }, (_, index) => (
          <Skeleton key={index} className="h-5 w-40" />
        ))}
      </div>
      <Skeleton className="h-[66px] w-full rounded-md" />
    </aside>
  );
}
