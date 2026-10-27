"use client";

import { useMemo, useState } from "react";

import { BookingMenu } from "@/components/bookings/booking-menu";
import { useBookingTools } from "@/components/bookings/booking-tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Segmented } from "@/components/ui/choice";
import { SearchInput } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@/components/ui/table";
import { downloadCsv } from "@/lib/csv";
import {
  balanceDue,
  balanceLabel,
  bookingStatus,
  originLabels,
  statusFilters,
  statusKey,
  type StatusFilter,
} from "@/lib/data/bookings/presentation";
import type { Booking } from "@/lib/data/types";
import { addDays, dayKey, shortDateTime } from "@/lib/dates";

type Period = "hoy" | "semana" | "mes";

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function NewBookingButton() {
  const { openNew } = useBookingTools();
  return (
    <Button icon="plus" onClick={() => openNew()}>
      Nueva reserva
    </Button>
  );
}

export function BookingsTable({
  bookings,
  today,
  initialStatus,
}: {
  bookings: Booking[];
  today: string;
  initialStatus: string | null;
}) {
  const { data, courtById, openDetail } = useBookingTools();
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState<Period>("hoy");
  const [status, setStatus] = useState<StatusFilter | null>(
    statusFilters.some((f) => f.value === initialStatus) ? (initialStatus as StatusFilter) : null,
  );
  const [court, setCourt] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    const [from, to] =
      period === "hoy" ? [today, today] : period === "semana" ? [today, addDays(today, 6)] : [`${today.slice(0, 8)}01`, `${today.slice(0, 8)}31`];
    return bookings.filter((booking) => {
      const day = dayKey(booking.start);
      if (day < from || day > to) return false;
      if (status && statusKey(booking) !== status) return false;
      if (court && booking.courtId !== court) return false;
      if (q && !normalize(`${booking.organizer.name} ${courtById(booking.courtId)?.name ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [bookings, query, period, status, court, today, courtById]);

  const exportCsv = () =>
    downloadCsv(
      `reservas-${today}.csv`,
      ["Fecha y hora", "Cancha", "Organizador", "Origen", "Estado", "Precio", "Saldo"],
      visible.map((b) => [
        shortDateTime(b.start),
        courtById(b.courtId)?.name ?? "",
        b.organizer.name,
        originLabels[b.origin],
        bookingStatus(b).label,
        b.price,
        balanceDue(b) ?? "",
      ]),
    );

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <SearchInput placeholder="Buscar por socio o cancha" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar reservas" />
        <Segmented
          label="Período"
          value={period}
          onChange={setPeriod}
          options={[
            { value: "hoy", label: "Hoy" },
            { value: "semana", label: "Semana" },
            { value: "mes", label: "Mes" },
          ]}
        />
        <Select
          label="Estado"
          value={status}
          onChange={(value) => setStatus(value === status ? null : value)}
          options={statusFilters}
        />
        <Select
          label="Todas las canchas"
          value={court}
          onChange={(value) => setCourt(value === court ? null : value)}
          options={data.courts.map((c) => ({ value: c.id, label: c.name }))}
          width={200}
        />
        <span className="flex-1" />
        <Button variant="secondary" icon="download" onClick={exportCsv} disabled={visible.length === 0}>
          Exportar
        </Button>
      </div>

      <Table label="Reservas">
        <TableHeader>
          <TableHeaderCell width={170}>Fecha y hora</TableHeaderCell>
          <TableHeaderCell width={100}>Cancha</TableHeaderCell>
          <TableHeaderCell grow>Organizador</TableHeaderCell>
          <TableHeaderCell width={110}>Partido</TableHeaderCell>
          <TableHeaderCell width={120}>Origen</TableHeaderCell>
          <TableHeaderCell width={190}>Estado</TableHeaderCell>
          <TableHeaderCell width={100}>Saldo</TableHeaderCell>
          <TableHeaderCell width={28} />
        </TableHeader>
        {visible.length === 0 ? (
          <EmptyState
            icon="calendar"
            title="No hay reservas con estos filtros"
            description="Probá con otro período o sacá los filtros de estado y cancha."
          />
        ) : (
          <TableBody>
            {visible.map((booking) => {
              const status = bookingStatus(booking);
              const match = booking.match && !booking.match.closed ? booking.match : null;
              return (
                <TableRow
                  key={booking.id}
                  selected={selected === booking.id}
                  onClick={() => {
                    setSelected(booking.id);
                    openDetail(booking);
                  }}
                >
                  <TableCell width={170} weight="semibold">
                    {shortDateTime(booking.start)}
                  </TableCell>
                  <TableCell width={100}>{courtById(booking.courtId)?.name ?? "—"}</TableCell>
                  <TableCell grow weight="semibold">
                    {match ? "Partido abierto" : booking.organizer.name}
                  </TableCell>
                  <TableCell width={110} tone="muted">
                    {match ? `${match.players.length} / ${match.needed}` : "—"}
                  </TableCell>
                  <TableCell width={120} tone="muted">
                    {originLabels[booking.origin]}
                  </TableCell>
                  <TableCell width={190}>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </TableCell>
                  <TableCell width={100} weight="bold">
                    {balanceLabel(booking)}
                  </TableCell>
                  <TableCell width={28}>
                    <BookingMenu booking={booking} />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </Table>

      <Callout>
        Cuando el socio paga en el club, tocá ··· › &quot;Registrar cobro&quot;. Una seña acreditada por Mercado Pago confirma la reserva
        sola.
      </Callout>
    </>
  );
}
