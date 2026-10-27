import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { listOpenMatches } from "@/lib/data/bookings/service";
import { getFixedSlotCounts, listFixedSlots } from "@/lib/data/fixed-slots/service";
import { dayKey, now } from "@/lib/dates";
import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { Card, CardTitle, Eyebrow } from "@/components/ui/card";
import { CountBadge } from "@/components/ui/badge";
import { PageHeader } from "@/components/ui/page-header";
import { weekdayLabels } from "@/lib/dates";

import { FixedSlotTools, LoadFixedSlotButton, RequestCard } from "./fixed-slot-tools";
import { MatchesCard } from "./matches-card";

export const metadata: Metadata = { title: "Turnos y partidos" };

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function TurnosYPartidosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TurnosYPartidosContent />
    </Suspense>
  );
}

async function TurnosYPartidosContent() {
  const today = dayKey(now());
  const [matches, requests, active, counts, tools] = await Promise.all([
    listOpenMatches(today),
    listFixedSlots("pedido"),
    listFixedSlots("activo"),
    getFixedSlotCounts(),
    getBookingToolsData(),
  ]);
  const courtName = (id: string | null) => tools.courts.find((c) => c.id === id)?.name ?? "cualquier cancha";
  const thisWeek = active.filter((slot) => slot.thisWeek === "reservado" || slot.thisWeek === "liberado").slice(0, 4);

  return (
    <BookingToolsProvider data={tools}>
      <FixedSlotTools courts={tools.courts} members={tools.members} today={today} activeSlots={active}>
        <PageHeader
          title="Turnos fijos y partidos"
          subtitle="Pedidos de turno fijo y partidos abiertos desde la app"
          actions={<LoadFixedSlotButton />}
        />
        <div className="flex min-h-0 flex-1 gap-5">
          <MatchesCard matches={matches} />

          <Card className="flex w-[360px] shrink-0 flex-col gap-3.5 p-5">
            <div className="flex flex-col gap-0.5">
              <CardTitle title="Turnos fijos" />
              <p className="text-body-sm font-medium text-ink-muted">
                {counts.active} activos · {counts.requests} {counts.requests === 1 ? "pedido" : "pedidos"} para revisar
              </p>
            </div>

            <div className="flex items-center gap-2">
              <Eyebrow>Pedidos desde la app</Eyebrow>
              {requests.length > 0 && <CountBadge count={requests.length} tone="warning" />}
            </div>
            {requests.length === 0 ? (
              <p className="rounded-md bg-surface-muted p-3.5 text-body-sm font-medium text-ink-muted">No hay pedidos para revisar.</p>
            ) : (
              requests.map((slot) => (
                <RequestCard
                  key={slot.id}
                  slot={slot}
                  description={`${weekdayLabels[slot.weekday].short} ${slot.time} · ${courtName(slot.courtId)} · ${slot.durationMin} min · desde ${slot.since.slice(8, 10)}/${slot.since.slice(5, 7)}`}
                  suggestedCourt={slot.availability?.suggestedCourtId ? tools.courts.find((c) => c.id === slot.availability!.suggestedCourtId)?.shortName : undefined}
                />
              ))
            )}

            <div className="my-1 h-px bg-line" />
            <Eyebrow>Activos · esta semana</Eyebrow>
            {thisWeek.map((slot) => (
              <div key={slot.id} className="flex items-center justify-between gap-3">
                <span className="truncate text-body-sm font-semibold text-ink">{slot.holder.name}</span>
                <span className="shrink-0 text-body-sm font-medium text-ink-muted">
                  {weekdayLabels[slot.weekday].short} {slot.time} · {tools.courts.find((c) => c.id === slot.courtId)?.shortName}
                  {slot.thisWeek === "liberado" && " · liberó"}
                </span>
              </div>
            ))}
            <Link href="/turnos-y-partidos/turnos-fijos" className="text-body-sm font-bold text-link hover:underline">
              Ver los {counts.active} turnos fijos
            </Link>
          </Card>
        </div>
      </FixedSlotTools>
    </BookingToolsProvider>
  );
}
