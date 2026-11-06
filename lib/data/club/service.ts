import "server-only";

import { hhmm } from "@/lib/dates";
import { sql } from "@/lib/db/sql";

import { iso, loadClub, pesos, type PriceRuleRow } from "../rows";
import type { BookingRules, ClubSettings, Court, OpeningHours, RateBand } from "../types";
import { categories, weekdays } from "../types";
import type { PricingTable } from "./pricing";

const TURN = 90;
const PEAK_FROM = 17 * 60;

/** Turns a court offers on a weekday with the club's grid (opening + step). */
function turnsPerDay(hours: { open_minute: number; close_minute: number }[], step: number) {
  return hours.reduce((sum, range) => sum + Math.max(0, Math.floor((range.close_minute - range.open_minute - TURN) / step) + 1), 0);
}

export async function getCourts(): Promise<Court[]> {
  const { club, courts, hours, closures } = await loadClub();
  const now = new Date();
  const weekdayHours = hours.filter((h) => h.weekday === 0);
  return courts.map((court, index) => {
    const closure = closures.find((c) => c.starts_at <= now && c.ends_at > now && (c.court_ids === null || c.court_ids.includes(court.id)));
    return {
      id: court.id,
      name: court.name,
      shortName: `C${court.sort_order || index + 1}`,
      type: court.indoor ? "techada" : "descubierta",
      enabled: court.active,
      maintenance: closure ? { until: iso(closure.ends_at), reason: closure.reason } : undefined,
      slotsPerDay: turnsPerDay(weekdayHours, club.slot_step_minutes),
    };
  });
}

/** Rate bands from in-api's price rules (general rules of the 90-minute turn). */
function ratesFrom(rules: PriceRuleRow[]): RateBand[] {
  const general = rules.filter((r) => r.court_ids === null && r.duration_minutes === TURN);
  const weekday = general.filter((r) => r.weekdays.includes(0)).sort((a, b) => a.start_minute - b.start_minute);
  const amountOn = (day: number, minute: number) =>
    pesos(general.find((r) => r.weekdays.includes(day) && r.start_minute <= minute && minute < r.end_minute)?.amount_cents);
  return weekday.map((rule) => {
    const kind = rule.start_minute >= PEAK_FROM ? "pico" : "valle";
    return {
      id: `${rule.start_minute}-${rule.end_minute}`,
      label: kind === "pico" ? "Pico" : "Valle",
      kind,
      from: hhmm(rule.start_minute),
      to: hhmm(Math.min(rule.end_minute, 24 * 60 - 1)),
      weekday: pesos(rule.amount_cents),
      saturday: amountOn(5, rule.start_minute),
      sunday: amountOn(6, rule.start_minute),
    };
  });
}

export async function getRates(): Promise<RateBand[]> {
  return ratesFrom((await loadClub()).prices);
}

export async function getBookingRules(): Promise<BookingRules> {
  const { club, prices } = await loadClub();
  const durations = club.durations_minutes.filter((d): d is 60 | 90 | 120 => d === 60 || d === 90 || d === 120);
  const peak = Math.max(0, ...ratesFrom(prices).map((rate) => rate.weekday));
  return {
    durations,
    defaultDuration: durations.includes(TURN) ? TURN : (durations[0] ?? TURN),
    maxAdvanceDays: club.booking_window_days,
    refundHoursBefore: club.cancellation_notice_hours,
    depositMinutes: club.hold_ttl_minutes,
    depositAmount: club.deposit_mode === "online" ? Math.round((peak * (club.deposit_percent ?? 0)) / 100) : 0,
    depositRequired: club.deposit_mode === "online",
  };
}

export async function getClubSettings(): Promise<ClubSettings> {
  const { club, hours, closures } = await loadClub();
  const opening = Object.fromEntries(
    weekdays.map((day, index) => {
      const ranges = hours.filter((h) => h.weekday === index);
      return [
        day,
        ranges.length
          ? { open: true, from: hhmm(Math.min(...ranges.map((r) => r.open_minute))), to: hhmm(Math.min(Math.max(...ranges.map((r) => r.close_minute)), 24 * 60 - 1)) }
          : { open: false, from: "08:00", to: "23:00" },
      ];
    }),
  ) as OpeningHours;
  return {
    name: club.name,
    phone: club.phone ?? "",
    address: club.address ?? "",
    openingDate: iso(club.created_at).slice(0, 10),
    hours: opening,
    // Whole-club closures; a closure for some courts is a block on the agenda.
    closedDays: closures
      .filter((c) => c.court_ids === null && c.ends_at > new Date())
      .map((c) => ({ id: c.id, from: iso(c.starts_at).slice(0, 10), to: iso(new Date(c.ends_at.getTime() - 1)).slice(0, 10), reason: c.reason })),
    categories: [...categories],
  };
}

export async function getPricing(): Promise<PricingTable> {
  const [rates, rules] = await Promise.all([getRates(), getBookingRules()]);
  return { rates, depositAmount: rules.depositAmount };
}

// ── Orden de las canchas en la app (court_display_priorities) ─────────

export type CourtOrder = {
  /** null = the default order. */
  date: string | null;
  /** Active courts, in the order the app shows them that day. */
  courts: { id: string; name: string; unavailable: boolean }[];
  /** The day has its own order (otherwise it uses the default one). */
  ownOrder: boolean;
};

/** Key of the closure that makes a court unavailable a whole day from this screen. */
export const unavailableKey = (date: string, courtId: string) => `panel-no-disponible-${date}-${courtId}`;

export async function getCourtOrder(date: string | null): Promise<CourtOrder> {
  const [{ courts }, priorities, closures] = await Promise.all([
    loadClub(),
    sql()<{ court_id: string; date: string | null; priority: number }[]>`
      select court_id, date::text, priority from app.court_display_priorities
      where date is null ${date ? sql()`or date = ${date}` : sql()``}`,
    date ? sql()<{ key: string }[]>`select key from app.club_closures where key like ${`panel-no-disponible-${date}-%`}` : [],
  ]);
  const ofDay = new Map(priorities.filter((p) => p.date !== null).map((p) => [p.court_id, p.priority]));
  const byDefault = new Map(priorities.filter((p) => p.date === null).map((p) => [p.court_id, p.priority]));
  const ownOrder = ofDay.size > 0;
  const priority = (id: string) => (ownOrder ? ofDay.get(id) : byDefault.get(id)) ?? Infinity;
  const closed = new Set(closures.map((c) => c.key));
  return {
    date,
    ownOrder,
    courts: courts
      .filter((court) => court.active)
      .map((court, index) => ({ court, index }))
      .sort((a, b) => priority(a.court.id) - priority(b.court.id) || a.index - b.index)
      .map(({ court }) => ({ id: court.id, name: court.name, unavailable: date ? closed.has(unavailableKey(date, court.id)) : false })),
  };
}
