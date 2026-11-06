"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { addDays, minutesOf, shortDateTime, toIso } from "@/lib/dates";
import { newId, sql } from "@/lib/db/sql";

import { personName } from "../rows";
import type { CourtBlock, PaymentConcept, PaymentMethod } from "../types";
import { cancelOccupancy, clubChanged, lockOccupancy, NOT_AVAILABLE, withTx } from "../writes";

const refresh = () => revalidatePath("/", "layout");

// ── Nueva reserva, mover, cobros (todavía no: los hace la app o el club en persona) ──

export type NewBookingInput = {
  courtId: string;
  day: string; // YYYY-MM-DD
  time: string; // HH:mm
  durationMin: 60 | 90 | 120;
  organizer: { kind: "socio"; memberId: string } | { kind: "invitado"; name: string; phone?: string };
  payment: "club" | "sena";
  repeatWeekly: boolean;
};

export async function createBooking(_input: NewBookingInput): Promise<ActionResult<{ id: string }>> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

export async function moveBooking(_input: { id: string; courtId: string; day: string; time: string }): Promise<ActionResult> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

export type RegisterPaymentInput = {
  bookingId?: string;
  memberName?: string;
  concept: PaymentConcept;
  amount: number;
  method: Exclude<PaymentMethod, "mercado-pago">;
  note?: string;
};

export async function registerPayment(_input: RegisterPaymentInput): Promise<ActionResult<{ amount: string }>> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

export async function resendDepositLink(_id: string): Promise<ActionResult> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

// ── Cancelar ──────────────────────────────────────────────────────────

export async function cancelBooking(input: { id: string; refund: boolean }): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) =>
    withTx(async (tx) => {
      const row = await lockOccupancy(tx, input.id);
      if (!row || (row.status !== "held" && row.status !== "confirmed")) throw new Error("La reserva ya estaba cancelada.");
      if (input.refund && !can(staff.role, "senas.devolver")) throw new Error("No tenés permiso para devolver señas.");
      await cancelOccupancy(tx, row, staff, { refund: input.refund, reason: "Cancelada desde el panel" });
      refresh();
      return undefined;
    }),
  );
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
  mantenimiento: "Mantenimiento",
  clase: "Clase",
  evento: "Evento del club",
  otro: "Bloqueo",
};

/** The block's ranges: one, or eight weekly ones. */
function blockRanges(input: BlockInput) {
  return Array.from({ length: input.repeatWeekly ? 8 : 1 }, (_, week) => {
    const day = addDays(input.day, week * 7);
    return { start: toIso(day, input.from), end: toIso(day, input.to) };
  });
}

type Conflict = { id: string; court: string; starts_at: Date; first_name: string | null; last_name: string | null; display_name: string | null; email: string | null };

async function conflictsOf(input: BlockInput): Promise<Conflict[]> {
  const db = sql();
  const ranges = blockRanges(input);
  return db<Conflict[]>`
    select o.id, c.name as court, lower(o.period) as starts_at, u.first_name, u.last_name, u.display_name, u.email
    from app.court_occupancy o
    join app.club_courts c on c.id = o.court_id
    left join app.users u on u.id = o.user_id
    where o.kind = 'booking' and o.status in ('held', 'confirmed') and o.court_id = any(${input.courtIds}::uuid[])
      and o.period && any(${ranges.map((r) => `[${r.start},${r.end})`)}::tstzrange[])
    order by lower(o.period)`;
}

function checkBlock(input: BlockInput) {
  if (input.courtIds.length === 0) throw new Error("Elegí al menos una cancha.");
  if (minutesOf(input.to) <= minutesOf(input.from)) throw new Error("La hora de fin tiene que ser después de la de inicio.");
}

/** Bookings that a block would cancel, so the modal can warn before confirming. */
export async function previewBlockConflicts(input: BlockInput): Promise<ActionResult<{ name: string; court: string; time: string }[]>> {
  return runAction("reservas.gestionar", async () => {
    if (input.courtIds.length === 0 || minutesOf(input.to) <= minutesOf(input.from)) return [];
    return (await conflictsOf(input)).map((c) => ({ name: personName(c), court: c.court, time: shortDateTime(c.starts_at) }));
  });
}

/**
 * Closures in in-api (club_closures): it turns them into blocks on the courts. Bookings already
 * there are cancelled here with their deposit refunded, and in-api notifies each member.
 */
export async function blockSchedule(input: BlockInput): Promise<ActionResult<{ cancelled: number }>> {
  return runAction("reservas.gestionar", async (staff) => {
    checkBlock(input);
    const conflicts = await conflictsOf(input);
    return withTx(async (tx) => {
      for (const range of blockRanges(input)) {
        const id = newId();
        await tx`
          insert into app.club_closures (id, key, starts_at, ends_at, court_ids, reason)
          values (${id}, ${`panel-${input.reason}-${id}`}, ${range.start}, ${range.end}, ${input.courtIds}::uuid[], ${reasonTitles[input.reason]})`;
      }
      for (const conflict of conflicts) {
        const row = await lockOccupancy(tx, conflict.id);
        if (row && (row.status === "held" || row.status === "confirmed"))
          await cancelOccupancy(tx, row, staff, { refund: true, reason: `Bloqueo de cancha: ${reasonTitles[input.reason]}` });
      }
      await clubChanged(tx);
      refresh();
      return { cancelled: conflicts.length };
    });
  });
}
