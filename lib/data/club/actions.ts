"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { addDays, dayKey, now, time, toIso } from "@/lib/dates";
import { audit } from "@/lib/db/outbox";
import { newId, sql } from "@/lib/db/sql";

import { personName } from "../rows";
import type { BookingRules, ClubSettings, CourtType, RateBand } from "../types";
import { activeBookingsIn, cancelOccupancy, clubChanged, lockOccupancy, NOT_AVAILABLE, withTx } from "../writes";
import { unavailableKey } from "./service";

const refresh = () => revalidatePath("/", "layout");

/*
 * The club lives in in-api's tables (club, club_courts, club_closures). Every change bumps the
 * config version and publishes club.config.changed: in-api reloads it and turns closures into
 * blocks on the courts. Rates, hours and new courts still come from in-api's club.yaml.
 */

// ── Canchas ───────────────────────────────────────────────────────────

export type CourtInput = {
  id?: string;
  name: string;
  type: CourtType;
  maintenance: { until: string; reason: string } | null; // until: "YYYY-MM-DDTHH:mm"
};

export async function saveCourt(_input: CourtInput): Promise<ActionResult<{ id: string }>> {
  return runAction("club.configurar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

export async function setCourtEnabled(input: { id: string; enabled: boolean }): Promise<ActionResult> {
  return runAction("club.configurar", (staff) =>
    withTx(async (tx) => {
      const [court] = await tx`update app.club_courts set active = ${input.enabled} where id = ${input.id} returning id`;
      if (!court) throw new Error("No encontramos la cancha.");
      await audit(tx, staff, input.enabled ? "court.enabled" : "court.disabled", { type: "court", id: input.id });
      await clubChanged(tx);
      refresh();
      return undefined;
    }),
  );
}

export async function removeCourt(_id: string): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

// ── Tarifas, reglas y datos del club (todavía desde club.yaml) ────────

export async function saveRatesAndRules(_input: { rates: RateBand[]; rules: BookingRules }): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

export async function saveClubSettings(_input: Omit<ClubSettings, "closedDays" | "categories"> & { categories: ClubSettings["categories"] }): Promise<ActionResult> {
  return runAction("club.configurar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

// ── Días cerrados ─────────────────────────────────────────────────────

/** Closes the whole club on a date range: cancels the bookings in it, refunding deposits. */
export async function addClosedDay(input: { from: string; to: string; reason: string }): Promise<ActionResult<{ cancelled: number }>> {
  return runAction("club.configurar", (staff) => {
    if (!input.from || !input.to) throw new Error("Elegí las fechas.");
    if (input.to < input.from) throw new Error("La fecha de fin tiene que ser igual o posterior a la de inicio.");
    if (input.from < dayKey(now())) throw new Error("No se pueden cerrar días que ya pasaron.");
    const reason = input.reason.trim();
    if (reason.length < 3) throw new Error("Escribí el motivo: lo ven los socios.");
    const start = toIso(input.from, "00:00");
    const end = toIso(addDays(input.to, 1), "00:00");
    return withTx(async (tx) => {
      const id = newId();
      await tx`
        insert into app.club_closures (id, key, starts_at, ends_at, court_ids, reason)
        values (${id}, ${`panel-cierre-${id}`}, ${start}, ${end}, null, ${reason})`;
      const bookings = await tx<{ id: string }[]>`
        select id from app.court_occupancy
        where kind = 'booking' and status in ('held', 'confirmed')
          and period && tstzrange(${start}::timestamptz, ${end}::timestamptz)`;
      for (const { id: bookingId } of bookings) {
        const row = await lockOccupancy(tx, bookingId);
        if (row) await cancelOccupancy(tx, row, staff, { refund: true, reason: `El club cierra: ${reason}` });
      }
      await audit(tx, staff, "club.closed_days_added", { type: "closure", id }, { from: input.from, to: input.to, reason });
      await clubChanged(tx);
      refresh();
      return { cancelled: bookings.length };
    });
  });
}

export async function removeClosedDay(id: string): Promise<ActionResult> {
  return runAction("club.configurar", (staff) =>
    withTx(async (tx) => {
      const [closure] = await tx`delete from app.club_closures where id = ${id} returning id`;
      if (!closure) throw new Error("Ese cierre ya no existe.");
      await audit(tx, staff, "club.closed_days_removed", { type: "closure", id });
      await clubChanged(tx);
      refresh();
      return undefined;
    }),
  );
}

// ── Orden de las canchas en la app ────────────────────────────────────

const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);

/**
 * The order the app shows the courts in: for a day (it overrides the default) or the default one
 * (date null). Only the display order: "any court" bookings still follow the club's court order.
 * in-api reads it on every availability request, so there is no event.
 */
export async function saveCourtOrder(input: { date: string | null; courtIds: string[] }): Promise<ActionResult> {
  return runAction("club.configurar", (staff) => {
    if (input.date !== null && !isDay(input.date)) throw new Error("Elegí el día.");
    if (input.date !== null && input.date < dayKey(now())) throw new Error("No se puede cambiar el orden de días que ya pasaron.");
    if (input.courtIds.length === 0 || new Set(input.courtIds).size !== input.courtIds.length) throw new Error("Revisá el orden de las canchas.");
    return withTx(async (tx) => {
      await tx`delete from app.court_display_priorities where date is not distinct from ${input.date}::date`;
      await tx`
        insert into app.court_display_priorities (court_id, date, priority)
        select court_id, ${input.date}::date, priority
        from unnest(${input.courtIds}::uuid[]) with ordinality as o(court_id, priority)`;
      await audit(tx, staff, "court.order_set", { type: "club", id: "1" }, { date: input.date, courtIds: input.courtIds });
      refresh();
      return undefined;
    });
  });
}

/** The day goes back to the default order. */
export async function resetCourtOrder(date: string): Promise<ActionResult> {
  return runAction("club.configurar", (staff) =>
    withTx(async (tx) => {
      await tx`delete from app.court_display_priorities where date = ${date}::date`;
      await audit(tx, staff, "court.order_reset", { type: "club", id: "1" }, { date });
      refresh();
      return undefined;
    }),
  );
}

function wholeDay(date: string) {
  return { start: toIso(date, "00:00"), end: toIso(addDays(date, 1), "00:00") };
}

/** Bookings that making the court unavailable that day would cancel. */
export async function previewCourtUnavailable(input: { date: string; courtId: string }): Promise<ActionResult<{ name: string; time: string }[]>> {
  return runAction("club.configurar", async () => {
    const { start, end } = wholeDay(input.date);
    return (await activeBookingsIn(sql(), [input.courtId], start, end)).map((b) => ({ name: personName(b), time: time(b.starts_at) }));
  });
}

/**
 * A whole-day closure for one court (in-api takes it out of the app that day). Its bookings are
 * cancelled with the deposit refunded, as with any block; unmarking it deletes the closure.
 */
export async function setCourtUnavailable(input: { date: string; courtId: string; unavailable: boolean }): Promise<ActionResult<{ cancelled: number }>> {
  return runAction("club.configurar", (staff) => {
    if (!isDay(input.date) || input.date < dayKey(now())) throw new Error("Elegí un día de hoy en adelante.");
    const key = unavailableKey(input.date, input.courtId);
    return withTx(async (tx) => {
      let cancelled = 0;
      if (input.unavailable) {
        const { start, end } = wholeDay(input.date);
        const [court] = await tx<{ name: string }[]>`select name from app.club_courts where id = ${input.courtId}`;
        if (!court) throw new Error("No encontramos la cancha.");
        await tx`
          insert into app.club_closures (id, key, starts_at, ends_at, court_ids, reason)
          values (${newId()}, ${key}, ${start}, ${end}, ${[input.courtId]}::uuid[], ${`${court.name} no disponible`})
          on conflict (key) do nothing`;
        const bookings = await activeBookingsIn(tx, [input.courtId], start, end);
        for (const booking of bookings) {
          const row = await lockOccupancy(tx, booking.id);
          if (row) await cancelOccupancy(tx, row, staff, { refund: true, reason: `${court.name} no disponible ese día` });
        }
        cancelled = bookings.length;
      } else {
        await tx`delete from app.club_closures where key = ${key}`;
      }
      await audit(tx, staff, input.unavailable ? "court.unavailable" : "court.available", { type: "court", id: input.courtId }, { date: input.date });
      await clubChanged(tx);
      refresh();
      return { cancelled };
    });
  });
}
