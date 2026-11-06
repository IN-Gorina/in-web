import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { KpiCard, KpiRow } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { getPaymentTotals, listPayments } from "@/lib/data/payments/service";
import { dayKey, monthName, now } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { PaymentsTable, RegisterPaymentButton } from "./payments-table";

export const metadata: Metadata = { title: "Pagos" };

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function PagosPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <PagosContent />
    </Suspense>
  );
}

async function PagosContent() {
  await connection();
  const [payments, totals, tools] = await Promise.all([listPayments(), getPaymentTotals(), getBookingToolsData()]);
  const month = monthName(now());

  return (
    <BookingToolsProvider data={tools}>
      <PageHeader
        title="Pagos"
        subtitle="Señas por Mercado Pago, saldos cobrados en el club y reintegros"
        actions={<RegisterPaymentButton />}
      />
      <KpiRow>
        <KpiCard
          highlight
          label={`Cobrado en ${month}`}
          value={formatMoney(totals.collected)}
          footnote={`Señas MP · ${totals.depositsCount} · saldos en club · ${totals.balancesCount}`}
        />
        <KpiCard
          label="Señas pendientes"
          value={formatMoney(totals.pendingAmount)}
          footnote={`${totals.pendingCount} reservas · se liberan a los 10 min`}
          trend="warning"
        />
        <KpiCard
          label="Reintegros del mes"
          value={formatMoney(totals.refundsAmount)}
          footnote={`${totals.refundsCount} señas devueltas · cancelación +24 h`}
        />
        <KpiCard label="Comisiones MP estimadas" value={formatMoney(totals.mpFees)} footnote="6,43% de las señas · costo del club" />
      </KpiRow>
      <PaymentsTable payments={payments} today={dayKey(now())} nowIso={now().toISOString()} />
    </BookingToolsProvider>
  );
}
