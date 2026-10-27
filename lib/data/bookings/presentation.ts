import type { BadgeTone } from "@/components/ui/badge";
import { formatMoney } from "@/lib/format";

import type { Booking, BookingOrigin } from "../types";

/** Status label for a booking, in the priority the designs use. */
export function bookingStatus(booking: Booking): { label: string; tone: BadgeTone } {
  if (booking.cancelled) {
    if (booking.depositStatus === "devuelta") return { label: "Cancelada · seña devuelta", tone: "danger" };
    if (booking.depositStatus === "retenida") return { label: "Cancelada · seña retenida", tone: "danger" };
    return { label: "Cancelada", tone: "danger" };
  }
  if (booking.match && !booking.match.closed) {
    const missing = booking.match.needed - booking.match.players.length;
    if (missing > 0) return { label: `Partido abierto · falta${missing > 1 ? "n" : ""} ${missing}`, tone: "info" };
    return { label: "Partido completo", tone: "info" };
  }
  if (booking.balancePaid) return { label: "Saldo cobrado", tone: "success" };
  if (booking.origin === "turno-fijo") return { label: "Turno fijo", tone: "success" };
  if (booking.depositStatus === "pendiente") return { label: "Seña pendiente", tone: "warning" };
  if (booking.depositStatus === "pagada") return { label: "Confirmada · seña", tone: "success" };
  return { label: "Paga en el club", tone: "neutral" };
}

export const statusFilters = [
  { value: "confirmada", label: "Confirmada · seña" },
  { value: "sena-pendiente", label: "Seña pendiente" },
  { value: "paga-en-club", label: "Paga en el club" },
  { value: "saldo-cobrado", label: "Saldo cobrado" },
  { value: "turno-fijo", label: "Turno fijo" },
  { value: "partido-abierto", label: "Partido abierto" },
  { value: "cancelada", label: "Cancelada" },
] as const;

export type StatusFilter = (typeof statusFilters)[number]["value"];

/** Which status filter a booking falls under (same priority as bookingStatus). */
export function statusKey(booking: Booking): StatusFilter {
  if (booking.cancelled) return "cancelada";
  if (booking.match && !booking.match.closed) return "partido-abierto";
  if (booking.balancePaid) return "saldo-cobrado";
  if (booking.origin === "turno-fijo") return "turno-fijo";
  if (booking.depositStatus === "pendiente") return "sena-pendiente";
  if (booking.depositStatus === "pagada") return "confirmada";
  return "paga-en-club";
}

/** What is still owed at the club. Null when nothing can be charged (seña pendiente, cancelled). */
export function balanceDue(booking: Booking): number | null {
  if (booking.cancelled || booking.depositStatus === "pendiente") return null;
  if (booking.balancePaid) return 0;
  return booking.price - (booking.depositStatus === "pagada" ? booking.deposit : 0);
}

export function balanceLabel(booking: Booking): string {
  const due = balanceDue(booking);
  return due === null ? "—" : formatMoney(due);
}

export const originLabels: Record<BookingOrigin, string> = {
  app: "App",
  recepcion: "Recepción",
  "turno-fijo": "Turno fijo",
};

export function endOf(booking: Pick<Booking, "start" | "durationMin">): string {
  return new Date(new Date(booking.start).getTime() + booking.durationMin * 60_000).toISOString();
}

/** "Pico" or "Valle" for a start time, by the club's bands (18:00 onwards is pico). */
export function bandLabel(startTime: string): "Pico" | "Valle" {
  return startTime >= "18:00" ? "Pico" : "Valle";
}
