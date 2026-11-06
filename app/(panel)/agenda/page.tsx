import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { KpiCard, KpiRow } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { balanceDue } from "@/lib/data/bookings/presentation";
import { getAgendaDay } from "@/lib/data/bookings/service";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { dayKey, longDate, minutesOf, now, time } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { AgendaActions, DayNav, OpenNewOnLoad } from "./agenda-actions";
import { AgendaGrid, AgendaSubtitle, CourtsInViewProvider } from "./agenda-grid";

export const metadata: Metadata = { title: "Agenda" };

const OPEN_FROM = "08:00";
const OPEN_TO = "24:00";

export default function AgendaPage({ searchParams }: PageProps<"/agenda">) {
  return (
    <Suspense fallback={<AgendaSkeleton />}>
      <Agenda searchParams={searchParams} />
    </Suspense>
  );
}

async function Agenda({ searchParams }: Pick<PageProps<"/agenda">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const today = dayKey(now());
  const day = typeof params.dia === "string" && /^\d{4}-\d{2}-\d{2}$/.test(params.dia) ? params.dia : today;
  const [agenda, tools] = await Promise.all([getAgendaDay(day), getBookingToolsData()]);
  const courts = tools.courts;

  const openMinutes = (minutesOf(OPEN_TO) - minutesOf(OPEN_FROM)) * courts.length;
  const booked = agenda.bookings.reduce((sum, booking) => sum + booking.durationMin, 0);
  const deposits = agenda.bookings
    .filter((b) => b.depositStatus === "pagada" && b.origin === "app")
    .reduce((sum, b) => sum + b.deposit, 0);
  const balances = agenda.bookings.reduce((sum, b) => sum + (balanceDue(b) ?? 0), 0);

  return (
    <BookingToolsProvider data={{ ...tools, bookings: mergeById(tools.bookings, agenda.bookings) }}>
      <CourtsInViewProvider>
        {params.nueva === "1" && <OpenNewOnLoad day={day} />}
        <PageHeader
          title="Agenda"
          subtitle={<AgendaSubtitle date={longDate(`${day}T12:00:00-03:00`)} courts={courts} />}
          actions={
            <>
              <DayNav day={day} today={today} />
              <AgendaActions day={day} />
            </>
          }
        />
        <KpiRow>
          <KpiCard label="Ocupación del día" value={`${Math.round((booked / openMinutes) * 100)}%`} />
          <KpiCard label="Reservas" value={String(agenda.bookings.length)} />
          <KpiCard label="Señas cobradas · Mercado Pago" value={formatMoney(deposits)} />
          <KpiCard label="Saldos a cobrar en el club" value={formatMoney(balances)} />
        </KpiRow>
        <AgendaGrid
          day={day}
          courts={courts}
          bookings={agenda.bookings}
          blocks={agenda.blocks}
          openFrom={OPEN_FROM}
          openTo={OPEN_TO}
          nowTime={day === today ? time(now()) : null}
        />
      </CourtsInViewProvider>
    </BookingToolsProvider>
  );
}

function mergeById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const map = new Map<string, T>();
  for (const item of [...a, ...b]) map.set(item.id, item);
  return [...map.values()];
}

function AgendaSkeleton() {
  return (
    <>
      <PageHeader title="Agenda" subtitle="Cargando el día…" />
      <div className="flex gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-[88px] flex-1 rounded-card" />
        ))}
      </div>
      <Skeleton className="flex-1 rounded-card" />
    </>
  );
}
