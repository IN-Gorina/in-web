import "server-only";

import { db } from "../mock/store";
import type { Booking, CourtBlock } from "../types";

const end = (start: string, minutes: number) => new Date(new Date(start).getTime() + minutes * 60_000).getTime();

/** Bookings (not cancelled) and blocks on `courtId` that overlap [start, start + minutes). */
export function findConflicts(courtId: string, start: string, minutes: number, ignoreBookingId?: string) {
  const from = new Date(start).getTime();
  const to = end(start, minutes);
  const store = db();
  const bookings: Booking[] = store.bookings.filter(
    (booking) =>
      booking.id !== ignoreBookingId &&
      !booking.cancelled &&
      booking.courtId === courtId &&
      new Date(booking.start).getTime() < to &&
      end(booking.start, booking.durationMin) > from,
  );
  const blocks: CourtBlock[] = store.blocks.filter(
    (block) =>
      block.courtIds.includes(courtId) && new Date(block.start).getTime() < to && new Date(block.end).getTime() > from,
  );
  return { bookings, blocks };
}
