import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { PermissionGate } from "@/components/shell/permission-gate";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { getBookingRules, getCourtOrder, getRates } from "@/lib/data/club/service";
import { getCurrentStaff } from "@/lib/data/session/service";
import { dayKey, now, nowIso } from "@/lib/dates";

import { CourtsAndRates } from "./courts-and-rates";

export const metadata: Metadata = { title: "Canchas y tarifas" };

const title = "Canchas y tarifas";
const subtitle = "Canchas, tarifas por franja y reglas de reserva y seña";

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function CanchasYTarifasPage({ searchParams }: PageProps<"/canchas-y-tarifas">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CanchasYTarifasContent searchParams={searchParams} />
    </Suspense>
  );
}

async function CanchasYTarifasContent({ searchParams }: Pick<PageProps<"/canchas-y-tarifas">, "searchParams">) {
  await connection();
  const { orden } = await searchParams;
  const today = dayKey(now());
  // ?orden=YYYY-MM-DD edits that day's court order; without it, the default order.
  const orderDate = typeof orden === "string" && /^\d{4}-\d{2}-\d{2}$/.test(orden) && orden >= today ? orden : null;
  const staff = await getCurrentStaff();
  if (!can(staff.role, "club.configurar")) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <PermissionGate permission="club.configurar">{null}</PermissionGate>
      </>
    );
  }
  const [tools, rates, rules, order] = await Promise.all([getBookingToolsData(), getRates(), getBookingRules(), getCourtOrder(orderDate)]);
  return (
    <BookingToolsProvider data={tools}>
      <CourtsAndRates title={title} subtitle={subtitle} courts={tools.courts} rates={rates} rules={rules} nowIso={nowIso()} order={order} today={today} />
    </BookingToolsProvider>
  );
}
