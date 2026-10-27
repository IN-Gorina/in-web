"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { addDays, minutesOf, now, nowIso, shortDateTime, toIso, toLocalIso, weekdayOf } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { priceFor } from "../club/pricing";
import { db, newId } from "../mock/store";
import type { Booking, CourtBlock, Payment, PaymentConcept, PaymentMethod } from "../types";
import { findConflicts } from "./schedule";

const refresh = () => revalidatePath("/", "layout");
const stamp = () => nowIso();

function courtName(courtId: string) {
  const court = db().courts.find((c) => c.id === courtId);
  if (!court) throw new Error("Esa cancha no existe.");
  return court;
}

function describeConflict(courtId: string, start: string, minutes: number, ignore?: string) {
  const { bookings, blocks } = findConflicts(courtId, start, minutes, ignore);
  if (blocks.length) return `${courtName(courtId).name} está bloqueada en ese horario (${blocks[0]!.title.toLowerCase()}).`;
  if (bookings.length) return `${courtName(courtId).name} ya está reservada: ${bookings[0]!.organizer.name} · ${shortDateTime(bookings[0]!.start)}.`;
  return null;
}

// ── Nueva reserva ─────────────────────────────────────────────────────

export type NewBookingInput = {
  courtId: string;
  day: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMin: 60 | 90 | 120;
  organizer: { kind: "socio"; memberId: string } | { kind: "invitado"; name: string; phone?: string };
  payment: "club" | "sena";
  repeatWeekly: boolean;
};

export async function createBooking(input: NewBookingInput): Promise<ActionResult<{ id: string }>> {
  return runAction("reservas.gestionar", (staff) => {
    const store = db();
    const court = courtName(input.courtId);
    if (court.maintenance && new Date(court.maintenance.until) > new Date(toIso(input.day, input.time)))
      throw new Error(`${court.name} está en mantenimiento.`);
    if (!/^\d{2}:\d{2}$/.test(input.time)) throw new Error("Revisá la hora: usá el formato 20:30.");
    const start = toIso(input.day, input.time);
    const conflict = describeConflict(input.courtId, start, input.durationMin);
    if (conflict) throw new Error(conflict);

    let organizer: Booking["organizer"];
    if (input.organizer.kind === "socio") {
      const memberId = input.organizer.memberId;
      const member = store.members.find((m) => m.id === memberId);
      if (!member) throw new Error("Elegí a qué socio va la reserva.");
      if (member.status === "bloqueado") throw new Error(`${member.name} está bloqueado y no puede reservar.`);
      organizer = { memberId: member.id, name: member.name };
    } else {
      const name = input.organizer.name.trim();
      if (name.length < 2) throw new Error("Escribí el nombre del invitado.");
      organizer = { name, guest: true };
    }

    const { price } = priceFor(store.rates, start, input.durationMin);
    const deposit = input.payment === "sena" ? store.rules.depositAmount : 0;
    const booking: Booking = {
      id: newId("b"),
      courtId: input.courtId,
      start,
      durationMin: input.durationMin,
      organizer,
      origin: "recepcion",
      price,
      deposit,
      depositStatus: input.payment === "sena" ? "pagada" : "no-aplica",
      balancePaid: false,
      history: [{ at: stamp(), text: "Cargada en recepción", by: staff.name }],
    };

    if (input.repeatWeekly) {
      const slotId = newId("fs");
      store.fixedSlots.push({
        id: slotId,
        holder: { memberId: organizer.memberId, name: organizer.name, note: "Cargado en recepción" },
        weekday: weekdayOf(start),
        time: input.time,
        durationMin: input.durationMin === 120 ? 90 : input.durationMin,
        courtId: input.courtId,
        status: "activo",
        since: input.day,
        price,
        thisWeek: "reservado",
      });
      booking.fixedSlotId = slotId;
      booking.origin = "turno-fijo";
    }

    store.bookings.push(booking);
    if (deposit > 0) {
      store.payments.push({
        id: newId("p"),
        at: stamp(),
        memberName: organizer.name,
        memberId: organizer.memberId,
        bookingId: booking.id,
        concept: "sena",
        title: `${court.name} · ${shortDateTime(start)}`,
        detail: "Seña cobrada en el club",
        method: "efectivo",
        status: "acreditado",
        amount: deposit,
        manual: true,
        registeredBy: staff.name,
      });
    }
    refresh();
    return { id: booking.id };
  });
}

// ── Mover de horario ──────────────────────────────────────────────────

export async function moveBooking(input: { id: string; courtId: string; day: string; time: string }): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) => {
    const booking = db().bookings.find((b) => b.id === input.id);
    if (!booking || booking.cancelled) throw new Error("La reserva ya no está activa.");
    const start = toIso(input.day, input.time);
    const conflict = describeConflict(input.courtId, start, booking.durationMin, booking.id);
    if (conflict) throw new Error(conflict);
    const before = `${courtName(booking.courtId).shortName} · ${shortDateTime(booking.start)}`;
    booking.courtId = input.courtId;
    booking.start = start;
    booking.history.unshift({ at: stamp(), text: `Movida desde ${before}. Le avisamos por push.`, by: staff.name });
    refresh();
    return undefined;
  });
}

// ── Cancelar ──────────────────────────────────────────────────────────

export async function cancelBooking(input: { id: string; refund: boolean }): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) => {
    const store = db();
    const booking = store.bookings.find((b) => b.id === input.id);
    if (!booking || booking.cancelled) throw new Error("La reserva ya estaba cancelada.");
    const hadDeposit = booking.depositStatus === "pagada";
    if (hadDeposit && input.refund && !can(staff.role, "senas.devolver"))
      throw new Error("Solo un administrador puede devolver señas. Cancelala sin devolver o pedile a un administrador.");

    booking.cancelled = { at: stamp(), by: staff.name };
    if (booking.depositStatus === "pendiente") booking.depositStatus = "no-aplica";
    if (hadDeposit) booking.depositStatus = input.refund ? "devuelta" : "retenida";
    booking.history.unshift({
      at: stamp(),
      text: hadDeposit ? `Cancelada en el club · seña ${input.refund ? "devuelta" : "retenida"}` : "Cancelada en el club",
      by: staff.name,
    });

    if (hadDeposit && input.refund) {
      store.payments.push({
        id: newId("p"),
        at: stamp(),
        memberName: booking.organizer.name,
        memberId: booking.organizer.memberId,
        bookingId: booking.id,
        concept: "sena",
        title: `${courtName(booking.courtId).name} · ${shortDateTime(booking.start)}`,
        detail: "Cancelada en el club · seña devuelta",
        method: "mercado-pago",
        status: "reintegrado",
        amount: -booking.deposit,
        manual: false,
        registeredBy: staff.name,
      });
    }
    refresh();
    return undefined;
  });
}

// ── Cobros ────────────────────────────────────────────────────────────

export type RegisterPaymentInput = {
  bookingId?: string;
  memberName?: string;
  concept: PaymentConcept;
  amount: number;
  method: Exclude<PaymentMethod, "mercado-pago">;
  note?: string;
};

export async function registerPayment(input: RegisterPaymentInput): Promise<ActionResult<{ amount: string }>> {
  return runAction("cobros.registrar", (staff) => {
    const store = db();
    if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Escribí un monto mayor a cero.");
    const booking = input.bookingId ? store.bookings.find((b) => b.id === input.bookingId) : undefined;
    if (input.bookingId && !booking) throw new Error("No encontramos esa reserva.");
    if (!booking && !input.memberName?.trim()) throw new Error("Elegí la reserva o escribí a nombre de quién es el cobro.");

    const payment: Payment = {
      id: newId("p"),
      at: stamp(),
      memberName: booking?.organizer.name ?? input.memberName!.trim(),
      memberId: booking?.organizer.memberId,
      bookingId: booking?.id,
      concept: input.concept,
      title: booking ? `${courtName(booking.courtId).name} · ${shortDateTime(booking.start)}` : "Cobro en el club",
      detail:
        input.concept === "saldo"
          ? "Saldo cobrado en el club"
          : input.concept === "sena"
            ? "Seña cobrada en el club"
            : input.note?.trim() || "Otro cobro",
      method: input.method,
      status: "acreditado",
      amount: Math.round(input.amount),
      manual: true,
      registeredBy: staff.name,
      note: input.note?.trim() || undefined,
    };
    store.payments.push(payment);

    if (booking) {
      if (input.concept === "saldo") booking.balancePaid = true;
      if (input.concept === "sena") {
        booking.depositStatus = "pagada";
        booking.depositExpiresAt = undefined;
      }
      booking.history.unshift({
        at: stamp(),
        text: `Cobró ${formatMoney(payment.amount)} · ${input.concept === "saldo" ? "saldo" : input.concept === "sena" ? "seña" : "otro"}`,
        by: staff.name,
      });
    }
    refresh();
    return { amount: formatMoney(payment.amount) };
  });
}

export async function resendDepositLink(id: string): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) => {
    const booking = db().bookings.find((b) => b.id === id);
    if (!booking || booking.depositStatus !== "pendiente") throw new Error("Esta reserva no tiene una seña pendiente.");
    booking.depositExpiresAt = toLocalIso(new Date(now().getTime() + db().rules.depositMinutes * 60_000));
    booking.history.unshift({ at: stamp(), text: "Se reenvió el link de seña", by: staff.name });
    refresh();
    return undefined;
  });
}

// ── Bloquear horario ──────────────────────────────────────────────────

export type BlockInput = {
  courtIds: string[];
  day: string;
  from: string;
  to: string;
  reason: CourtBlock["reason"];
  repeatWeekly: boolean;
};

const reasonTitles: Record<CourtBlock["reason"], string> = {
  mantenimiento: "Bloqueada · mantenimiento",
  clase: "Bloqueo · clase",
  evento: "Bloqueo · evento del club",
  otro: "Bloqueada",
};

/** Bookings that a block would cancel, so the modal can warn before confirming. */
export async function previewBlockConflicts(input: BlockInput): Promise<ActionResult<{ name: string; court: string; time: string }[]>> {
  return runAction("reservas.gestionar", () => {
    if (minutesOf(input.to) <= minutesOf(input.from)) return [];
    const start = toIso(input.day, input.from);
    const minutes = minutesOf(input.to) - minutesOf(input.from);
    return input.courtIds.flatMap((courtId) =>
      findConflicts(courtId, start, minutes).bookings.map((booking) => ({
        name: booking.organizer.name,
        court: courtName(courtId).shortName,
        time: shortDateTime(booking.start),
      })),
    );
  });
}

export async function blockSchedule(input: BlockInput): Promise<ActionResult<{ cancelled: number }>> {
  return runAction("reservas.gestionar", (staff) => {
    const store = db();
    if (input.courtIds.length === 0) throw new Error("Elegí al menos una cancha.");
    const minutes = minutesOf(input.to) - minutesOf(input.from);
    if (minutes <= 0) throw new Error("La hora de fin tiene que ser después de la de inicio.");

    let cancelled = 0;
    const weeks = input.repeatWeekly ? 8 : 1;
    for (let week = 0; week < weeks; week++) {
      const day = addDays(input.day, week * 7);
      const start = toIso(day, input.from);
      store.blocks.push({
        id: newId("bl"),
        courtIds: [...input.courtIds],
        start,
        end: toIso(day, input.to),
        reason: input.reason,
        title: reasonTitles[input.reason],
      });
      for (const courtId of input.courtIds) {
        for (const booking of findConflicts(courtId, start, minutes).bookings) {
          booking.cancelled = { at: stamp(), by: staff.name };
          if (booking.depositStatus === "pagada") booking.depositStatus = "devuelta";
          booking.history.unshift({ at: stamp(), text: "Cancelada por un bloqueo de la cancha · le avisamos por push", by: staff.name });
          cancelled++;
        }
      }
    }
    refresh();
    return { cancelled };
  });
}
