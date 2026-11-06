import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { listMemberBookings } from "@/lib/data/bookings/service";
import { getMember } from "@/lib/data/members/service";
import { listReports } from "@/lib/data/moderation/service";
import { getCurrentStaff } from "@/lib/data/session/service";
import { now } from "@/lib/dates";

import { ModerationView, type ReportAuthor } from "./moderation-view";

export const metadata: Metadata = { title: "Moderación" };

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function ModeracionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ModeracionContent />
    </Suspense>
  );
}

async function ModeracionContent() {
  await connection();
  const [reports, staff] = await Promise.all([listReports(), getCurrentStaff()]);

  // What "Bloquear socio" needs about each author: whether they're blocked already and how many
  // upcoming bookings of theirs the block would cancel.
  const authorIds = [...new Set(reports.map((r) => r.author.memberId))];
  const nowMs = now().getTime();
  const authors: Record<string, ReportAuthor> = Object.fromEntries(
    await Promise.all(
      authorIds.map(async (id) => {
        const [member, bookings] = await Promise.all([getMember(id), listMemberBookings(id)]);
        const upcoming = bookings.filter((b) => b.organizer.memberId === id && !b.cancelled && new Date(b.start).getTime() >= nowMs).length;
        return [id, { blocked: member?.status === "bloqueado", upcoming }] as const;
      }),
    ),
  );

  return (
    <>
      <PageHeader title="Moderación" subtitle="Publicaciones denunciadas por los socios. Lo que ocultás deja de verse en la app." />
      <ModerationView reports={reports} authors={authors} canBlock={can(staff.role, "socios.bloquear")} />
    </>
  );
}
