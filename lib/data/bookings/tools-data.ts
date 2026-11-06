import "server-only";

import { connection } from "next/server";

import type { BookingToolsData } from "@/components/bookings/booking-tools";
import { can } from "@/lib/auth/permissions";
import { addDays, dayKey, now } from "@/lib/dates";

import { getCourts, getPricing } from "../club/service";
import { listMembers } from "../members/service";
import { getCurrentStaff } from "../session/service";
import type { Booking } from "../types";
import { listBookings } from "./service";

/**
 * Data for <BookingToolsProvider>. Includes bookings from yesterday to two weeks ahead, plus any
 * extra bookings the page shows, so the drawer and the cobro modal can find them.
 */
export async function getBookingToolsData(extra: Booking[] = []): Promise<BookingToolsData> {
  // Real data, as of this request.
  await connection();
  const today = dayKey(now());
  const [staff, courts, members, pricing, upcoming] = await Promise.all([
    getCurrentStaff(),
    getCourts(),
    listMembers(),
    getPricing(),
    listBookings({ from: addDays(today, -1), to: addDays(today, 14) }),
  ]);
  const byId = new Map<string, Booking>();
  for (const booking of [...upcoming, ...extra]) byId.set(booking.id, booking);

  return {
    courts,
    members: members.map((member) => ({
      id: member.id,
      name: member.name,
      category: member.category,
      phone: member.phone,
      email: member.email,
      blocked: member.status === "bloqueado",
    })),
    pricing,
    today,
    canRefund: can(staff.role, "senas.devolver"),
    staffName: staff.name,
    bookings: [...byId.values()],
  };
}
