import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { getClubSettings, getCourts } from "@/lib/data/club/service";
import { listEvents } from "@/lib/data/events/service";
import { listMembers } from "@/lib/data/members/service";
import { dayKey, now } from "@/lib/dates";

import { EventsView, NewEventButton } from "./events-view";

export const metadata: Metadata = { title: "Eventos" };

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function EventosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EventosContent />
    </Suspense>
  );
}

async function EventosContent() {
  await connection();
  const [events, courts, members, club] = await Promise.all([listEvents(), getCourts(), listMembers(), getClubSettings()]);
  const memberOptions = members.map((m) => ({
    id: m.id,
    name: m.name,
    category: m.category,
    phone: m.phone,
    email: m.email,
    blocked: m.status === "bloqueado",
  }));
  const context = { courts, members: memberOptions, today: dayKey(now()), pushAudience: members.filter((member) => member.notificationsOn).length, club: { address: club.address } };

  return (
    <EventsView events={events} context={context}>
      <PageHeader title="Eventos" subtitle="Lo que se ve en Social › Eventos de la app" actions={<NewEventButton />} />
    </EventsView>
  );
}
