import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";

import { BookingToolsProvider } from "@/components/bookings/booking-tools";
import { PageHeader } from "@/components/ui/page-header";
import { Table, TableHeader, TableHeaderCell } from "@/components/ui/table";
import { TableSkeleton } from "@/components/ui/states";
import { listBookings } from "@/lib/data/bookings/service";
import { getBookingToolsData } from "@/lib/data/bookings/tools-data";
import { addDays, dayKey, now } from "@/lib/dates";

import { NewBookingButton, BookingsTable } from "./bookings-table";

export const metadata: Metadata = { title: "Reservas" };

const subtitle = "Seña online, saldo a cobrar en el club y estado de cada reserva";

export default function ReservasPage({ searchParams }: PageProps<"/reservas">) {
  return (
    <Suspense
      fallback={
        <>
          <PageHeader title="Reservas" subtitle={subtitle} />
          <Table label="Reservas">
            <TableHeader>
              <TableHeaderCell grow>Cargando</TableHeaderCell>
            </TableHeader>
            <TableSkeleton />
          </Table>
        </>
      }
    >
      <Reservas searchParams={searchParams} />
    </Suspense>
  );
}

async function Reservas({ searchParams }: Pick<PageProps<"/reservas">, "searchParams">) {
  await connection();
  const params = await searchParams;
  const today = dayKey(now());
  const monthStart = `${today.slice(0, 8)}01`;
  const [bookings, tools] = await Promise.all([
    listBookings({ from: monthStart, to: addDays(monthStart, 40) }),
    getBookingToolsData(),
  ]);

  return (
    <BookingToolsProvider data={{ ...tools, bookings: [...new Map([...tools.bookings, ...bookings].map((b) => [b.id, b])).values()] }}>
      <PageHeader title="Reservas" subtitle={subtitle} actions={<NewBookingButton />} />
      <BookingsTable
        bookings={bookings}
        today={today}
        initialStatus={typeof params.estado === "string" ? params.estado : null}
      />
    </BookingToolsProvider>
  );
}
