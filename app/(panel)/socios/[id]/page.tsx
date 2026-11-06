import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/states";
import { can } from "@/lib/auth/permissions";
import { bookingStatus } from "@/lib/data/bookings/presentation";
import { listMemberBookings } from "@/lib/data/bookings/service";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { listEvents } from "@/lib/data/events/service";
import { listFixedSlots } from "@/lib/data/fixed-slots/service";
import { getMember } from "@/lib/data/members/service";
import { getCurrentStaff } from "@/lib/data/session/service";
import { now, weekdayLabels } from "@/lib/dates";

import { MemberProfile, type ProfileRow } from "./member-profile";

export const metadata: Metadata = { title: "Perfil del socio" };

/** Paper "Panel / 07b – Perfil del socio". */
export default function MemberPage({ params }: PageProps<"/socios/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader back={{ href: "/socios", label: "Socios" }} title="Cargando…" />
          <Skeleton className="h-[88px] rounded-card" />
          <Skeleton className="flex-1 rounded-card" />
        </>
      }
    >
      <Profile params={params} />
    </Suspense>
  );
}

async function Profile({ params }: Pick<PageProps<"/socios/[id]">, "params">) {
  await connection();
  const { id } = await params;
  const member = await getMember(id);
  if (!member) notFound();

  const [bookings, slots, events, staff, tools] = await Promise.all([
    listMemberBookings(id),
    listFixedSlots(),
    listEvents(),
    getCurrentStaff(),
    getBookingToolsData(),
  ]);
  const courtName = (courtId: string | null) => tools.courts.find((c) => c.id === courtId)?.name ?? "Cualquier cancha";
  const nowMs = now().getTime();

  const rows: ProfileRow[] = [
    ...bookings.map((b): ProfileRow => {
      const status = bookingStatus(b);
      const own = b.organizer.memberId === id;
      return {
        id: b.id,
        bookingId: b.id,
        start: b.start,
        place: `${courtName(b.courtId)} · ${b.durationMin} min`,
        description: b.match
          ? own
            ? "Partido abierto propio"
            : `Partido abierto de ${b.organizer.name}`
          : b.origin === "turno-fijo"
            ? "Turno fijo"
            : "Reserva propia",
        badge: b.match && !own ? { label: `Anotado · ${b.match.players.length}/${b.match.needed}`, tone: "info" } : status,
        amount: own ? b.price : null,
        future: new Date(b.start).getTime() >= nowMs,
      };
    }),
    ...slots
      .filter((s) => s.holder.memberId === id && s.status !== "baja")
      .map((s): ProfileRow => ({
        id: s.id,
        start: `${s.since}T${s.time}:00-03:00`,
        place: `${courtName(s.courtId)} · ${s.durationMin} min`,
        description: `Turno fijo · todos los ${weekdayLabels[s.weekday].plural}`,
        badge: s.status === "pedido" ? { label: "Pedido para revisar", tone: "info" } : { label: "Turno fijo activo", tone: "success" },
        amount: s.price,
        future: true,
      })),
    ...events
      .filter((e) => e.start && e.attendees.some((a) => a.memberId === id))
      .map((e): ProfileRow => {
        const attendee = e.attendees.find((a) => a.memberId === id)!;
        return {
          id: e.id,
          start: e.start!,
          place: e.courtIds.length ? `${e.courtIds.length} canchas` : "Club",
          description: `Evento · ${e.title}`,
          badge: attendee.paid === "mercado-pago" ? { label: "Pagó · MP", tone: "success" } : { label: "Paga en el club", tone: "warning" },
          amount: e.pricePerPerson,
          future: new Date(e.start!).getTime() >= nowMs,
        };
      }),
  ].sort((a, b) => a.start.localeCompare(b.start));

  return (
    <BookingToolsProvider data={tools}>
      <MemberProfile member={member} rows={rows} canBlock={can(staff.role, "socios.bloquear")} />
    </BookingToolsProvider>
  );
}
