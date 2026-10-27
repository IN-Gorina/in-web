import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { listBookings } from "@/lib/data/bookings/service";
import { getCourts } from "@/lib/data/club/service";
import { getMemberTotals, listMembers } from "@/lib/data/members/service";
import { getCurrentStaff } from "@/lib/data/session/service";
import { addDays, dayKey, now } from "@/lib/dates";
import { formatCount } from "@/lib/format";

import { AddMemberButton, MembersView, type MemberBookingSummary } from "./members-view";

export const metadata: Metadata = { title: "Socios" };

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function SociosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <SociosContent />
    </Suspense>
  );
}

async function SociosContent() {
  const today = dayKey(now());
  const [members, totals, staff, courts, bookings] = await Promise.all([
    listMembers(),
    getMemberTotals(),
    getCurrentStaff(),
    getCourts(),
    listBookings({ from: addDays(today, -30), to: addDays(today, 30) }),
  ]);

  // The two most relevant bookings per member for the side panel: upcoming first, then recent.
  const byMember: Record<string, MemberBookingSummary[]> = {};
  const nowMs = now().getTime();
  const isFuture = (iso: string) => new Date(iso).getTime() >= nowMs;
  const sorted = [...bookings].sort((a, b) => {
    const aFuture = isFuture(a.start);
    const bFuture = isFuture(b.start);
    return aFuture === bFuture ? (aFuture ? a.start.localeCompare(b.start) : b.start.localeCompare(a.start)) : aFuture ? -1 : 1;
  });
  for (const booking of sorted) {
    const id = booking.organizer.memberId;
    if (!id || booking.cancelled) continue;
    (byMember[id] ??= []).push({
      id: booking.id,
      start: booking.start,
      court: courts.find((c) => c.id === booking.courtId)?.name ?? "",
      future: isFuture(booking.start),
      price: booking.price,
      deposit: booking.deposit,
      depositStatus: booking.depositStatus,
      balancePaid: booking.balancePaid,
    });
  }

  return (
    <>
      <PageHeader
        title="Socios"
        subtitle={`${formatCount(totals.active)} activos · ${totals.newThisMonth} nuevos este mes`}
        actions={<AddMemberButton />}
      />
      <MembersView members={members} bookingsByMember={byMember} canBlock={can(staff.role, "socios.bloquear")} />
    </>
  );
}
