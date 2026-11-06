import "server-only";

import type postgres from "postgres";

import { audit, emit, topics } from "@/lib/db/outbox";
import { withTx, type Tx } from "@/lib/db/sql";
import { dayKey } from "@/lib/dates";

import { personName } from "./rows";
import type { StaffMember } from "./types";

/*
 * What the panel's actions write, mirroring in-api's services so its consumers (notifications,
 * refunds, availability, club cache) react the same way. Every helper runs in the caller's
 * transaction.
 */

export { withTx };

/** Thrown for "not something the panel can do (yet)", shown to the staff as is. */
export const NOT_AVAILABLE = "Esto todavía no se puede hacer desde el panel.";

type OccupancyRow = {
  id: string;
  court_id: string;
  kind: string;
  status: string;
  user_id: string | null;
  replaces_id: string | null;
  hold_expires_at: Date | null;
  starts_at: Date;
  ends_at: Date;
};

export async function lockOccupancy(tx: Tx, id: string): Promise<OccupancyRow | undefined> {
  const [row] = await tx<OccupancyRow[]>`
    select id, court_id, kind, status, user_id, replaces_id, hold_expires_at,
           lower(period) as starts_at, upper(period) as ends_at
    from app.court_occupancy where id = ${id} for update`;
  return row;
}

/** Local dates an occupancy touches (in-api's availability cache keys). */
function datesOf(row: OccupancyRow): string[] {
  const dates = new Set<string>();
  for (let t = row.starts_at.getTime(); t < row.ends_at.getTime(); t += 3_600_000) dates.add(dayKey(new Date(t)));
  dates.add(dayKey(new Date(row.ends_at.getTime() - 1)));
  return [...dates].sort();
}

/**
 * Cancels a confirmed booking (or releases one waiting for its deposit), like in-api's
 * OccupancyService.cancel: `occupancy.changed` always, and `booking.cancelled` with
 * `refundEligible` for a member's booking, which in-api uses to refund the deposit and notify.
 */
export async function cancelOccupancy(tx: Tx, row: OccupancyRow, staff: StaffMember, options: { refund: boolean; reason: string }) {
  const to = row.status === "held" ? "released" : "cancelled";
  if (row.status !== "held" && row.status !== "confirmed") throw new Error("La reserva ya no está activa.");
  await tx`update app.court_occupancy set status = ${to} where id = ${row.id} and status = ${row.status}`;
  await emit(tx, {
    topic: topics.occupancyChanged,
    aggregateType: "occupancy",
    aggregateId: row.id,
    payload: {
      occupancyId: row.id,
      courtId: row.court_id,
      dates: datesOf(row),
      status: to,
      userId: row.user_id,
      kind: row.kind,
      freed: to === "cancelled",
      startsAt: row.starts_at.toISOString(),
    },
  });
  // Like in-api: only a member's own booking (not a fixed-slot week) gets refunded and notified.
  if (to === "cancelled" && row.user_id && row.kind === "booking")
    await emit(tx, {
      topic: topics.bookingCancelled,
      aggregateType: "booking",
      aggregateId: row.id,
      payload: { bookingId: row.id, userId: row.user_id, replacesId: row.replaces_id, refundEligible: options.refund },
    });
  await audit(tx, staff, "booking.cancelled", { type: "booking", id: row.id }, { refund: options.refund, reason: options.reason });
}

type ActiveBooking = { id: string; starts_at: Date; first_name: string | null; last_name: string | null; display_name: string | null; email: string | null };

/** Members' bookings still on (held or confirmed) on these courts in [start, end). */
export function activeBookingsIn(db: postgres.Sql | Tx, courtIds: string[], start: string, end: string) {
  return db<ActiveBooking[]>`
    select o.id, lower(o.period) as starts_at, u.first_name, u.last_name, u.display_name, u.email
    from app.court_occupancy o left join app.users u on u.id = o.user_id
    where o.kind = 'booking' and o.status in ('held', 'confirmed') and o.court_id = any(${courtIds}::uuid[])
      and o.period && tstzrange(${start}::timestamptz, ${end}::timestamptz)
    order by lower(o.period)`;
}

/** After changing courts, hours or closures: in-api reloads the club and re-materializes blocks. */
export async function clubChanged(tx: Tx) {
  const [club] = await tx<{ config_version: number }[]>`
    update app.club set config_version = config_version + 1 returning config_version`;
  await emit(tx, { topic: topics.clubConfigChanged, aggregateType: "club", aggregateId: "1", payload: { version: club!.config_version } });
}

// ── Members ───────────────────────────────────────────────────────────

type UserRow = { id: string; firebase_uid: string; status: "active" | "suspended"; first_name: string | null; last_name: string | null; display_name: string | null; email: string | null };

export async function lockUser(tx: Tx, id: string) {
  const [user] = await tx<UserRow[]>`
    select id, firebase_uid, status, first_name, last_name, display_name, email
    from app.users where id = ${id} and deleted_at is null for update`;
  if (!user) throw new Error("No encontramos ese socio.");
  return user;
}

/**
 * Blocks a member: suspended in in-api (the API rejects them), signed out of the app, and their
 * upcoming bookings cancelled with the deposit refunded.
 */
export async function suspendMember(tx: Tx, staff: StaffMember, id: string, reason: string): Promise<{ cancelled: number; firebaseUid: string }> {
  const user = await lockUser(tx, id);
  if (user.status === "suspended") throw new Error(`${personName(user)} ya está bloqueado.`);
  await tx`update app.users set status = 'suspended', sessions_revoked_at = now() where id = ${id}`;
  const bookings = await tx<{ id: string }[]>`
    select id from app.court_occupancy
    where user_id = ${id} and kind = 'booking' and status in ('held', 'confirmed') and lower(period) > now()`;
  for (const booking of bookings) {
    const row = await lockOccupancy(tx, booking.id);
    if (row) await cancelOccupancy(tx, row, staff, { refund: true, reason: "Socio bloqueado por el club" });
  }
  await audit(tx, staff, "member.blocked", { type: "user", id }, { reason });
  return { cancelled: bookings.length, firebaseUid: user.firebase_uid };
}
