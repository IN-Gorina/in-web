"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { addDays, dayKey, now, nowIso, toIso, weekdayLabels, weekdayOf } from "@/lib/dates";

import { priceFor } from "../club/pricing";
import { db, newId } from "../mock/store";
import type { Weekday } from "../types";

const refresh = () => revalidatePath("/", "layout");

/** Next date (from today) that falls on `weekday`. */
function nextDate(weekday: Weekday, from = dayKey(now())): string {
  let day = from;
  for (let i = 0; i < 7 && weekdayOf(`${day}T12:00:00-03:00`) !== weekday; i++) day = addDays(day, 1);
  return day;
}

export async function approveFixedSlot(input: { id: string; courtId?: string }): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", () => {
    const slot = db().fixedSlots.find((s) => s.id === input.id);
    if (!slot || slot.status !== "pedido") throw new Error("Ese pedido ya fue resuelto.");
    const courtId = input.courtId ?? slot.courtId ?? slot.availability?.suggestedCourtId;
    if (!courtId) throw new Error("Elegí en qué cancha queda el turno fijo.");
    slot.courtId = courtId;
    slot.status = "activo";
    slot.thisWeek = "empieza";
    slot.since = slot.since < dayKey(now()) ? nextDate(slot.weekday) : slot.since;
    refresh();
    return undefined;
  });
}

export async function rejectFixedSlot(input: { id: string; reason: string; offer?: { courtId: string; time: string } }): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", () => {
    const store = db();
    const slot = store.fixedSlots.find((s) => s.id === input.id);
    if (!slot || slot.status !== "pedido") throw new Error("Ese pedido ya fue resuelto.");
    const court = input.offer ? store.courts.find((c) => c.id === input.offer!.courtId) : undefined;
    slot.status = "baja";
    slot.rejection = {
      reason: input.reason,
      offer: input.offer && court ? `${weekdayLabels[slot.weekday].long} ${input.offer.time} · ${court.name}` : undefined,
    };
    refresh();
    return undefined;
  });
}

export async function createFixedSlot(input: {
  memberId: string;
  weekday: Weekday;
  time: string;
  durationMin: 60 | 90;
  courtId: string;
  since: string;
}): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", () => {
    const store = db();
    const member = store.members.find((m) => m.id === input.memberId);
    if (!member) throw new Error("Elegí el titular del turno fijo.");
    if (!/^\d{2}:\d{2}$/.test(input.time)) throw new Error("Revisá la hora: usá el formato 20:00.");
    const taken = store.fixedSlots.find(
      (s) => s.status === "activo" && s.courtId === input.courtId && s.weekday === input.weekday && s.time === input.time,
    );
    if (taken) throw new Error(`Ese horario ya es el turno fijo de ${taken.holder.name}.`);
    const since = nextDate(input.weekday, input.since);
    store.fixedSlots.push({
      id: newId("fs"),
      holder: { memberId: member.id, name: member.name, note: "Cargado en recepción" },
      weekday: input.weekday,
      time: input.time,
      durationMin: input.durationMin,
      courtId: input.courtId,
      status: "activo",
      since,
      price: priceFor(store.rates, toIso(since, input.time), input.durationMin).price,
      thisWeek: since === dayKey(now()) ? "reservado" : "empieza",
    });
    refresh();
    return undefined;
  });
}

export async function endFixedSlot(id: string): Promise<ActionResult> {
  return runAction("turnosFijos.aprobar", () => {
    const slot = db().fixedSlots.find((s) => s.id === id);
    if (!slot || slot.status !== "activo") throw new Error("Ese turno fijo ya no está activo.");
    slot.status = "baja";
    slot.thisWeek = undefined;
    refresh();
    return undefined;
  });
}

// ── Partidos abiertos ─────────────────────────────────────────────────

/** Push to members of a compatible level who follow open matches. Mocked: returns the audience size. */
export async function notifyCompatiblePlayers(bookingId: string): Promise<ActionResult<{ count: number }>> {
  return runAction("reservas.gestionar", () => {
    const booking = db().bookings.find((b) => b.id === bookingId);
    if (!booking?.match) throw new Error("Ese partido ya no existe.");
    booking.history.unshift({ at: nowIso(), text: `Avisamos a socios de ${booking.match.level}` });
    refresh();
    return { count: 40 + booking.match.level.length * 9 };
  });
}

/** Stops publishing the match in Social › Partidos. The booking and its deposit stay with the organizer. */
export async function closeMatch(bookingId: string): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) => {
    const booking = db().bookings.find((b) => b.id === bookingId);
    if (!booking?.match) throw new Error("Ese partido ya no existe.");
    booking.match.closed = true;
    booking.history.unshift({ at: nowIso(), text: "Partido cerrado desde el panel", by: staff.name });
    refresh();
    return undefined;
  });
}
