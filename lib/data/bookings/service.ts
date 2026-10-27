import "server-only";

import { addDays, dayKey } from "@/lib/dates";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { Booking, CourtBlock } from "../types";

const byStart = (a: { start: string }, b: { start: string }) => a.start.localeCompare(b.start);

/** Bookings whose day (club time) is between `from` and `to`, both inclusive ("YYYY-MM-DD"). */
export async function listBookings({ from, to }: { from: string; to: string }): Promise<Booking[]> {
  const bookings = db()
    .bookings.filter((booking) => {
      const day = dayKey(booking.start);
      return day >= from && day <= to;
    })
    .sort(byStart);
  return mockResponse(bookings);
}

export async function getBooking(id: string): Promise<Booking | null> {
  return mockResponse(db().bookings.find((booking) => booking.id === id) ?? null);
}

/** Bookings a member organizes or plays in (open matches list players by name). */
export async function listMemberBookings(memberId: string): Promise<Booking[]> {
  const name = db().members.find((member) => member.id === memberId)?.name;
  return mockResponse(
    db()
      .bookings.filter(
        (booking) => booking.organizer.memberId === memberId || (name !== undefined && booking.match?.players.includes(name)),
      )
      .sort(byStart),
  );
}

export type AgendaDay = { bookings: Booking[]; blocks: CourtBlock[] };

/** Everything that occupies a court on `day`, cancelled bookings excluded. */
export async function getAgendaDay(day: string): Promise<AgendaDay> {
  const store = db();
  return mockResponse({
    bookings: store.bookings.filter((booking) => !booking.cancelled && dayKey(booking.start) === day).sort(byStart),
    blocks: store.blocks.filter((block) => dayKey(block.start) === day),
  });
}

/** Open matches from today on. */
export async function listOpenMatches(today: string): Promise<Booking[]> {
  return mockResponse(
    db()
      .bookings.filter((booking) => booking.match && !booking.cancelled && dayKey(booking.start) >= today)
      .sort(byStart),
  );
}

export function weekRange(day: string): { from: string; to: string } {
  return { from: day, to: addDays(day, 6) };
}
