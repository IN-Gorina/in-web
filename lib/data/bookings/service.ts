import "server-only";

import { addDays, toIso } from "@/lib/dates";

import { iso, loadClub, queryBookings } from "../rows";
import type { Booking, CourtBlock } from "../types";

/** Bookings whose day (club time) is between `from` and `to`, both inclusive ("YYYY-MM-DD"). */
export async function listBookings({ from, to }: { from: string; to: string }): Promise<Booking[]> {
  return queryBookings(
    (db) => db`lower(o.period) >= ${toIso(from, "00:00")}::timestamptz and lower(o.period) < ${toIso(addDays(to, 1), "00:00")}::timestamptz`,
  );
}

export async function getBooking(id: string): Promise<Booking | null> {
  const [booking] = await queryBookings((db) => db`o.id = ${id}`);
  return booking ?? null;
}

/** Bookings a member organizes or plays in. */
export async function listMemberBookings(memberId: string): Promise<Booking[]> {
  return queryBookings(
    (db) => db`(o.user_id = ${memberId} or exists (
      select 1 from app.matches mm join app.match_participants mp on mp.match_id = mm.id
      where mm.booking_id = o.id and mp.user_id = ${memberId}))`,
  );
}

export type AgendaDay = { bookings: Booking[]; blocks: CourtBlock[] };

/** Everything that occupies a court on `day`, cancelled bookings excluded. */
export async function getAgendaDay(day: string): Promise<AgendaDay> {
  const start = toIso(day, "00:00");
  const end = toIso(addDays(day, 1), "00:00");
  const [bookings, { closures, courts }] = await Promise.all([
    queryBookings(
      (db) => db`o.status in ('held', 'confirmed', 'completed', 'no_show')
        and o.period && tstzrange(${start}::timestamptz, ${end}::timestamptz)`,
    ),
    loadClub(),
  ]);
  const blocks: CourtBlock[] = closures
    .filter((closure) => closure.starts_at < new Date(end) && closure.ends_at > new Date(start))
    .map((closure) => ({
      id: closure.id,
      courtIds: closure.court_ids ?? courts.map((court) => court.id),
      start: iso(closure.starts_at),
      end: iso(closure.ends_at),
      reason: closure.key.startsWith("mantenimiento") ? "mantenimiento" : "otro",
      title: closure.reason,
    }));
  return { bookings, blocks };
}

/** Open matches from today on. */
export async function listOpenMatches(today: string): Promise<Booking[]> {
  const bookings = await queryBookings(
    (db) => db`o.status in ('held', 'confirmed') and lower(o.period) >= ${toIso(today, "00:00")}::timestamptz
      and exists (select 1 from app.matches mm where mm.booking_id = o.id)`,
  );
  return bookings.filter((booking) => booking.match);
}

export function weekRange(day: string): { from: string; to: string } {
  return { from: day, to: addDays(day, 6) };
}
