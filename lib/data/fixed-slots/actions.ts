"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { emit, audit, topics } from "@/lib/db/outbox";
import type { Tx } from "@/lib/db/sql";

import type { Weekday } from "../types";
import { cancelOccupancy, lockOccupancy, NOT_AVAILABLE, withTx } from "../writes";

const refresh = () => revalidatePath("/", "layout");

/*
 * Fixed slots are in-api's recurring_bookings. Deciding a request mirrors FixedSlotsService.decide:
 * same changes and the same fixed_slot.decided event (in-api notifies the member). in-api's
 * scheduler then books the approved weeks (every 5 minutes).
 */

type SlotRow = { id: string; user_id: string | null; status: string; court_id: string | null; weekday: number; start_minute: number; duration_minutes: number; starts_on: string };

async function lockPending(tx: Tx, id: string): Promise<SlotRow & { user_id: string }> {
  const [slot] = await tx<SlotRow[]>`
    select id, user_id, status, court_id, weekday, start_minute, duration_minutes, starts_on::text
    from app.recurring_bookings where id = ${id} for update`;
  if (!slot?.user_id || slot.status !== "pending") throw new Error("Ese pedido ya fue resuelto.");
  return slot as SlotRow & { user_id: string };
}

/** Courts of `candidates` free on every one of the slot's next weeks, in the club's order. */
async function freeCourts(tx: Tx, slot: SlotRow, candidates: string[]): Promise<string[]> {
  const [club] = await tx<{ weeks: number }[]>`select fixed_slot_weeks as weeks from app.club limit 1`;
  const weeks = club?.weeks ?? 8;
  const busy = await tx<{ court_id: string }[]>`
    with days as (
      select (date_trunc('week', greatest(${slot.starts_on}::date, current_date)) + make_interval(days => ${slot.weekday} + 7 * w))::date as d
      from generate_series(0, ${weeks - 1}) w
    ),
    ranges as (
      select tstzrange(
        (d + make_interval(mins => ${slot.start_minute}))::timestamp at time zone 'America/Argentina/Buenos_Aires',
        (d + make_interval(mins => ${slot.start_minute + slot.duration_minutes}))::timestamp at time zone 'America/Argentina/Buenos_Aires') as r
      from days where d >= greatest(${slot.starts_on}::date, current_date)
    )
    select distinct o.court_id from app.court_occupancy o join ranges on o.period && ranges.r
    where o.court_id = any(${candidates}::uuid[]) and o.status in ('held', 'confirmed')`;
  const taken = new Set(busy.map((b) => b.court_id));
  const ordered = await tx<{ id: string }[]>`
    select id from app.club_courts where id = any(${candidates}::uuid[]) and active order by sort_order`;
  return ordered.map((c) => c.id).filter((id) => !taken.has(id));
}

async function decided(tx: Tx, slot: SlotRow & { user_id: string }, outcome: "approved" | "rejected", reason: string | null) {
  await emit(tx, {
    topic: topics.fixedSlotDecided,
    aggregateType: "fixed_slot",
    aggregateId: slot.id,
    payload: { fixedSlotId: slot.id, userId: slot.user_id, outcome, reason },
  });
}

export async function approveFixedSlot(input: { id: string; courtId?: string }): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", (staff) =>
    withTx(async (tx) => {
      const slot = await lockPending(tx, input.id);
      const [club] = await tx<{ court_ids: string[] | null }[]>`select fixed_slot_court_ids as court_ids from app.club limit 1`;
      const candidates = input.courtId ? [input.courtId] : slot.court_id ? [slot.court_id] : (club?.court_ids ?? []);
      if (candidates.length === 0) throw new Error("Elegí en qué cancha queda el turno fijo.");
      const [courtId] = await freeCourts(tx, slot, candidates);
      if (!courtId) throw new Error("Ese horario no está libre todas las semanas. Elegí otra cancha o rechazá el pedido.");
      await tx`
        update app.recurring_bookings set status = 'active', active = true, court_id = ${courtId}, decided_at = now()
        where id = ${slot.id}`;
      await decided(tx, slot, "approved", null);
      await audit(tx, staff, "fixed_slot.approved", { type: "fixed_slot", id: slot.id }, { courtId });
      refresh();
      return undefined;
    }),
  );
}

export async function rejectFixedSlot(input: { id: string; reason: string; offer?: { courtId: string; time: string } }): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", (staff) =>
    withTx(async (tx) => {
      const slot = await lockPending(tx, input.id);
      const reason = [input.reason.trim(), input.offer ? `Te ofrecemos las ${input.offer.time}.` : ""].filter(Boolean).join(" ") || null;
      await tx`
        update app.recurring_bookings set status = 'rejected', decided_at = now(), rejection_reason = ${reason}
        where id = ${slot.id}`;
      await decided(tx, slot, "rejected", reason);
      await audit(tx, staff, "fixed_slot.rejected", { type: "fixed_slot", id: slot.id }, { reason });
      refresh();
      return undefined;
    }),
  );
}

export async function createFixedSlot(_input: { memberId: string; weekday: Weekday; time: string; durationMin: 60 | 90; courtId: string; since: string }): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

/** Ends an active fixed slot: no more weeks are booked, and the upcoming ones are cancelled. */
export async function endFixedSlot(id: string): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", (staff) =>
    withTx(async (tx) => {
      const [slot] = await tx`
        update app.recurring_bookings set status = 'cancelled', active = false, ends_on = current_date
        where id = ${id} and status = 'active' returning id`;
      if (!slot) throw new Error("Ese turno fijo ya no está activo.");
      const weeks = await tx<{ id: string }[]>`
        select id from app.court_occupancy
        where recurring_id = ${id} and status = 'confirmed' and lower(period) > now()`;
      for (const week of weeks) {
        const row = await lockOccupancy(tx, week.id);
        if (row) await cancelOccupancy(tx, row, staff, { refund: false, reason: "Baja del turno fijo" });
      }
      await audit(tx, staff, "fixed_slot.ended", { type: "fixed_slot", id });
      refresh();
      return undefined;
    }),
  );
}

// ── Partidos abiertos (los maneja el organizador desde la app) ────────

export async function notifyCompatiblePlayers(_bookingId: string): Promise<ActionResult<{ count: number }>> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

export async function closeMatch(_bookingId: string): Promise<ActionResult> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}
