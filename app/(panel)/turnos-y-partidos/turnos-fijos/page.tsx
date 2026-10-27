import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { PageHeader } from "@/components/ui/page-header";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { listFixedSlots } from "@/lib/data/fixed-slots/service";

import { FixedSlotTools, LoadFixedSlotButton } from "../fixed-slot-tools";
import { FixedSlotsTable } from "./fixed-slots-table";

export const metadata: Metadata = { title: "Turnos fijos" };

/** Paper "Panel / 05b – Todos los turnos fijos". */
/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function TurnosFijosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <TurnosFijosContent />
    </Suspense>
  );
}

async function TurnosFijosContent() {
  const [slots, tools] = await Promise.all([listFixedSlots(), getBookingToolsData()]);
  const active = slots.filter((slot) => slot.status === "activo");

  return (
    <BookingToolsProvider data={tools}>
      <FixedSlotTools courts={tools.courts} members={tools.members} today={tools.today} activeSlots={active}>
        <PageHeader
          back={{ href: "/turnos-y-partidos", label: "Turnos y partidos" }}
          title="Turnos fijos"
          subtitle={`${active.length} activos · se reservan solos cada semana a nombre del titular`}
          actions={<LoadFixedSlotButton />}
        />
        <FixedSlotsTable slots={slots} courts={tools.courts} />
      </FixedSlotTools>
    </BookingToolsProvider>
  );
}
