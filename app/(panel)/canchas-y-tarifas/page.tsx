import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { PermissionGate } from "@/components/shell/permission-gate";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { getBookingRules, getRates } from "@/lib/data/club/service";
import { getCurrentStaff } from "@/lib/data/session/service";
import { nowIso } from "@/lib/dates";

import { CourtsAndRates } from "./courts-and-rates";

export const metadata: Metadata = { title: "Canchas y tarifas" };

const title = "Canchas y tarifas";
const subtitle = "Canchas, tarifas por franja y reglas de reserva y seña";

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function CanchasYTarifasPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CanchasYTarifasContent />
    </Suspense>
  );
}

async function CanchasYTarifasContent() {
  const staff = await getCurrentStaff();
  if (!can(staff.role, "club.configurar")) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <PermissionGate permission="club.configurar">{null}</PermissionGate>
      </>
    );
  }
  const [tools, rates, rules] = await Promise.all([getBookingToolsData(), getRates(), getBookingRules()]);
  return (
    <BookingToolsProvider data={tools}>
      <CourtsAndRates title={title} subtitle={subtitle} courts={tools.courts} rates={rates} rules={rules} nowIso={nowIso()} />
    </BookingToolsProvider>
  );
}
