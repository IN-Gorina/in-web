"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { dayKey, now, nowIso, toIso } from "@/lib/dates";

import { db, newId } from "../mock/store";
import type { BookingRules, ClosedDay, ClubSettings, CourtType, RateBand } from "../types";

const refresh = () => revalidatePath("/", "layout");

// ── Canchas ───────────────────────────────────────────────────────────

export type CourtInput = {
  id?: string;
  name: string;
  type: CourtType;
  maintenance: { until: string; reason: string } | null; // until: "YYYY-MM-DDTHH:mm"
};

export async function saveCourt(input: CourtInput): Promise<ActionResult<{ id: string }>> {
  return runAction("club.configurar", () => {
    const store = db();
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Escribí el nombre de la cancha.");
    if (store.courts.some((c) => c.id !== input.id && c.name.toLowerCase() === name.toLowerCase())) throw new Error("Ya hay una cancha con ese nombre.");
    let maintenance: { until: string; reason: string } | undefined;
    if (input.maintenance) {
      const [day, time] = input.maintenance.until.split("T");
      if (!day || !time) throw new Error("Elegí hasta cuándo está en mantenimiento.");
      const until = toIso(day, time);
      if (new Date(until) <= now()) throw new Error("La fecha de fin del mantenimiento ya pasó.");
      maintenance = { until, reason: input.maintenance.reason.trim() || "Mantenimiento" };
    }
    const existing = input.id ? store.courts.find((c) => c.id === input.id) : undefined;
    if (existing) {
      existing.name = name;
      existing.type = input.type;
      existing.maintenance = maintenance;
      refresh();
      return { id: existing.id };
    }
    const number = store.courts.length + 1;
    const court = { id: newId("c"), name, shortName: `C${number}`, type: input.type, enabled: true, slotsPerDay: 10, maintenance };
    store.courts.push(court);
    refresh();
    return { id: court.id };
  });
}

export async function setCourtEnabled(input: { id: string; enabled: boolean }): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    const court = db().courts.find((c) => c.id === input.id);
    if (!court) throw new Error("No encontramos la cancha.");
    court.enabled = input.enabled;
    refresh();
    return undefined;
  });
}

export async function removeCourt(id: string): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    const store = db();
    const future = store.bookings.filter((b) => b.courtId === id && !b.cancelled && new Date(b.start) > now());
    if (future.length) throw new Error(`Tiene ${future.length} reservas futuras. Movelas o cancelalas antes de darla de baja.`);
    store.courts = store.courts.filter((c) => c.id !== id);
    refresh();
    return undefined;
  });
}

// ── Tarifas y reglas ──────────────────────────────────────────────────

export async function saveRatesAndRules(input: { rates: RateBand[]; rules: BookingRules }): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    for (const band of input.rates) {
      for (const value of [band.weekday, band.saturday, band.sunday]) {
        if (!Number.isFinite(value) || value <= 0) throw new Error(`Revisá las tarifas de ${band.label.toLowerCase()}: tienen que ser mayores a cero.`);
      }
    }
    if (input.rules.depositRequired && input.rules.depositAmount <= 0) throw new Error("Escribí el monto de la seña.");
    const store = db();
    store.rates = input.rates;
    store.rules = input.rules;
    refresh();
    return undefined;
  });
}

// ── Configuración del club ────────────────────────────────────────────

export async function saveClubSettings(input: Omit<ClubSettings, "closedDays" | "categories"> & { categories: ClubSettings["categories"] }): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    if (input.name.trim().length < 3) throw new Error("Escribí el nombre del club.");
    for (const [day, hours] of Object.entries(input.hours)) {
      if (hours.open && (!/^\d{2}:\d{2}$/.test(hours.from) || !/^\d{2}:\d{2}$/.test(hours.to))) throw new Error(`Revisá el horario del ${day}.`);
    }
    const store = db();
    store.settings = { ...store.settings, ...input, name: input.name.trim(), closedDays: store.settings.closedDays };
    refresh();
    return undefined;
  });
}

/** Closes the club on a date range: cancels bookings and fixed-slot turns in it, refunding deposits. */
export async function addClosedDay(input: { from: string; to: string; reason: string }): Promise<ActionResult<{ cancelled: number }>> {
  return runAction("club.configurar", (staff) => {
    if (!input.from || !input.to) throw new Error("Elegí las fechas.");
    if (input.to < input.from) throw new Error("La fecha de fin tiene que ser igual o posterior a la de inicio.");
    if (input.from < dayKey(now())) throw new Error("No se pueden cerrar días que ya pasaron.");
    if (input.reason.trim().length < 3) throw new Error("Escribí el motivo: lo ven los socios.");
    const store = db();
    const closed: ClosedDay = { id: newId("cd"), from: input.from, to: input.to, reason: input.reason.trim() };
    store.settings.closedDays.push(closed);
    store.settings.closedDays.sort((a, b) => a.from.localeCompare(b.from));
    let cancelled = 0;
    for (const booking of store.bookings) {
      const day = dayKey(booking.start);
      if (booking.cancelled || day < input.from || day > input.to) continue;
      booking.cancelled = { at: nowIso(), by: staff.name };
      if (booking.depositStatus === "pagada") booking.depositStatus = "devuelta";
      booking.history.unshift({ at: nowIso(), text: `Cancelada: el club cierra (${closed.reason})`, by: staff.name });
      cancelled++;
    }
    refresh();
    return { cancelled };
  });
}

export async function removeClosedDay(id: string): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    const store = db();
    store.settings.closedDays = store.settings.closedDays.filter((d) => d.id !== id);
    refresh();
    return undefined;
  });
}
