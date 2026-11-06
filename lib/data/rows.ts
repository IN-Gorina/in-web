import "server-only";

import { cache } from "react";

import { toLocalIso } from "@/lib/dates";
import { sql } from "@/lib/db/sql";

import type { Booking, Category, Weekday } from "./types";
import { categories, weekdays } from "./types";

/*
 * Reading in-api's tables into the panel's types. Shared by the feature services; nothing here
 * writes. Amounts in the database are cents; the panel shows whole pesos.
 */

export const pesos = (cents: number | string | bigint | null | undefined) => Math.round(Number(cents ?? 0) / 100);

export const iso = (value: Date | string) => toLocalIso(new Date(value));

type NameRow = { first_name?: string | null; last_name?: string | null; display_name?: string | null; email?: string | null };

export function personName(row: NameRow, fallback = "Socio"): string {
  const full = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return row.display_name || full || row.email?.split("@")[0] || fallback;
}

/** users.category is 1 (best) … 8. */
export function categoryOf(value: number | null | undefined): Category | undefined {
  return value ? categories.find((c) => c === `${value}ª`) : undefined;
}

/** in-api numbers weekdays 0 = Monday … 6 = Sunday, the panel's order. */
export const weekdayAt = (index: number): Weekday => weekdays[index]!;

// ── Club configuration (one read per request) ─────────────────────────

export type ClubRow = {
  name: string;
  phone: string | null;
  address: string | null;
  created_at: Date;
  booking_window_days: number;
  slot_step_minutes: number;
  durations_minutes: number[];
  cancellation_notice_hours: number;
  deposit_mode: "none" | "online";
  deposit_percent: number | null;
  hold_ttl_minutes: number;
  config_version: number;
};
export type CourtRow = { id: string; key: string; name: string; indoor: boolean; sort_order: number; active: boolean };
export type HoursRow = { weekday: number; open_minute: number; close_minute: number };
export type PriceRuleRow = { weekdays: number[]; start_minute: number; end_minute: number; duration_minutes: number; amount_cents: string; court_ids: string[] | null };
export type ClosureRow = { id: string; key: string; starts_at: Date; ends_at: Date; court_ids: string[] | null; reason: string };

export const loadClub = cache(async () => {
  const db = sql();
  const [[club], courts, hours, prices, closures] = await Promise.all([
    db<ClubRow[]>`select * from app.club limit 1`,
    db<CourtRow[]>`select id, key, name, indoor, sort_order, active from app.club_courts order by sort_order, name`,
    db<HoursRow[]>`select weekday, open_minute, close_minute from app.club_opening_hours order by weekday, open_minute`,
    db<PriceRuleRow[]>`select weekdays, start_minute, end_minute, duration_minutes, amount_cents, court_ids from app.club_price_rules`,
    db<ClosureRow[]>`select id, key, starts_at, ends_at, court_ids, reason from app.club_closures where ends_at > now() - interval '30 days' order by starts_at`,
  ]);
  if (!club) throw new Error("El club todavía no está configurado (falta el seed de in-api).");
  return { club, courts, hours, prices, closures };
});

/** Price of a turn with in-api's rules: a rule for the court beats a general one. Null if none. */
export function priceCents(rules: PriceRuleRow[], slot: { courtId: string | null; weekday: number; startMinute: number; durationMinutes: number }): number | null {
  const candidates = rules.filter(
    (r) =>
      r.weekdays.includes(slot.weekday) &&
      r.duration_minutes === slot.durationMinutes &&
      r.start_minute <= slot.startMinute &&
      slot.startMinute < r.end_minute &&
      (r.court_ids === null || (slot.courtId !== null && r.court_ids.includes(slot.courtId))),
  );
  const specific = candidates.filter((r) => r.court_ids !== null);
  const winners = specific.length > 0 ? specific : candidates;
  return winners.length === 1 ? Number(winners[0]!.amount_cents) : null;
}

// ── Bookings ──────────────────────────────────────────────────────────

type BookingRow = NameRow & {
  id: string;
  court_id: string;
  kind: "booking" | "recurring";
  status: "held" | "confirmed" | "expired" | "released" | "cancelled" | "completed" | "no_show";
  user_id: string | null;
  recurring_id: string | null;
  price_cents: string | null;
  hold_expires_at: Date | null;
  updated_at: Date;
  starts_at: Date;
  ends_at: Date;
  holder_label: string | null;
  deposit_cents: string | null;
  deposit_status: "pending" | "approved" | "rejected" | "expired" | "refunded" | null;
  match_status: "open" | "full" | "cancelled" | "finished" | "pending_payment" | null;
  spots: number | null;
  taken: number | null;
  min_category: number | null;
  max_category: number | null;
  players: string[];
  history: { at: string; to: BookingRow["status"] }[];
};

const statusText: Record<BookingRow["status"], string> = {
  held: "Reservó desde la app · seña pendiente",
  confirmed: "Confirmada",
  expired: "Venció la seña: se liberó el turno",
  released: "Liberada",
  cancelled: "Cancelada",
  completed: "Jugada",
  no_show: "No se presentó",
};

function depositStatusOf(row: BookingRow): Booking["depositStatus"] {
  switch (row.deposit_status) {
    case null:
      return "no-aplica";
    case "approved":
      return row.status === "cancelled" ? "retenida" : "pagada";
    case "refunded":
      return "devuelta";
    case "pending":
      return row.status === "held" ? "pendiente" : "no-aplica";
    default:
      return "no-aplica";
  }
}

function toBooking(row: BookingRow): Booking {
  const minutes = Math.round((row.ends_at.getTime() - row.starts_at.getTime()) / 60_000);
  const gone = row.status === "cancelled" || row.status === "expired" || row.status === "released";
  const name = row.user_id ? personName(row) : (row.holder_label ?? "Turno fijo");
  const match =
    row.match_status && row.match_status !== "pending_payment"
      ? {
          level:
            row.min_category === row.max_category
              ? `${row.max_category}ª`
              : `${row.max_category}ª a ${row.min_category}ª`,
          players: row.players,
          needed: row.players.length + Math.max((row.spots ?? 0) - (row.taken ?? 0), 0),
          closed: row.match_status === "cancelled" || row.match_status === "finished",
        }
      : undefined;
  return {
    id: row.id,
    courtId: row.court_id,
    start: iso(row.starts_at),
    durationMin: minutes as Booking["durationMin"],
    organizer: { memberId: row.user_id ?? undefined, name },
    origin: row.kind === "recurring" ? "turno-fijo" : "app",
    price: pesos(row.price_cents),
    deposit: pesos(row.deposit_cents),
    depositStatus: depositStatusOf(row),
    depositExpiresAt: row.status === "held" && row.hold_expires_at ? iso(row.hold_expires_at) : undefined,
    balancePaid: row.status === "completed",
    cancelled: gone ? { at: iso(row.updated_at), by: statusText[row.status] } : undefined,
    fixedSlotId: row.recurring_id ?? undefined,
    match,
    history: row.history.map((event) => ({ at: iso(event.at), text: statusText[event.to] })),
  };
}

/** Bookings and fixed-slot weeks matching `where` (a fragment over court_occupancy `o`). */
export async function queryBookings(where: (db: ReturnType<typeof sql>) => ReturnType<ReturnType<typeof sql>>): Promise<Booking[]> {
  const db = sql();
  const rows = await db<BookingRow[]>`
    select o.id, o.court_id, o.kind, o.status, o.user_id, o.recurring_id, o.price_cents,
           o.hold_expires_at, o.updated_at, lower(o.period) as starts_at, upper(o.period) as ends_at,
           u.first_name, u.last_name, u.display_name, u.email, r.holder_label,
           pi.amount_cents as deposit_cents, pi.status as deposit_status,
           m.status as match_status, m.spots, m.taken, m.min_category, m.max_category,
           coalesce((
             select array_agg(coalesce(nullif(pu.display_name, ''), concat_ws(' ', pu.first_name, pu.last_name)) order by mp.joined_at)
             from app.match_participants mp join app.users pu on pu.id = mp.user_id
             where mp.match_id = m.id), '{}') as players,
           coalesce((
             select json_agg(json_build_object('at', e.occurred_at, 'to', e.to_status) order by e.version)
             from app.occupancy_events e where e.occupancy_id = o.id), '[]') as history
    from app.court_occupancy o
    left join app.users u on u.id = o.user_id
    left join app.recurring_bookings r on r.id = o.recurring_id
    left join lateral (
      select amount_cents, status from app.payment_intents p
      where p.occupancy_id = o.id order by p.created_at desc limit 1
    ) pi on true
    left join app.matches m on m.booking_id = o.id
    where o.kind in ('booking', 'recurring') and ${where(db)}
    order by lower(o.period), o.court_id`;
  return rows.map(toBooking);
}
