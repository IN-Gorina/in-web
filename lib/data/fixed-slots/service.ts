import "server-only";

import { hhmm } from "@/lib/dates";
import { sql } from "@/lib/db/sql";

import { iso, loadClub, personName, pesos, priceCents, weekdayAt } from "../rows";
import type { FixedSlot, FixedSlotStatus } from "../types";

type FixedSlotRow = {
  id: string;
  court_id: string | null;
  user_id: string | null;
  status: "pending" | "active" | "rejected" | "withdrawn" | "cancelled";
  active: boolean;
  rejection_reason: string | null;
  weekday: number;
  start_minute: number;
  duration_minutes: number;
  holder_label: string | null;
  starts_on: Date | string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
};

const statusOf = (row: FixedSlotRow): FixedSlotStatus =>
  row.status === "pending" ? "pedido" : row.status === "active" && row.active ? "activo" : "baja";

export async function listFixedSlots(status?: FixedSlotStatus): Promise<FixedSlot[]> {
  const [rows, { prices }] = await Promise.all([
    sql()<FixedSlotRow[]>`
      select r.id, r.court_id, r.user_id, r.status, r.active, r.rejection_reason, r.weekday, r.start_minute,
             r.duration_minutes, r.holder_label, r.starts_on, u.first_name, u.last_name, u.display_name, u.email
      from app.recurring_bookings r left join app.users u on u.id = r.user_id
      order by r.weekday, r.start_minute`,
    loadClub(),
  ]);
  return rows
    .map((row): FixedSlot => {
      const price = priceCents(prices, { courtId: row.court_id, weekday: row.weekday, startMinute: row.start_minute, durationMinutes: row.duration_minutes });
      return {
        id: row.id,
        holder: { memberId: row.user_id ?? undefined, name: row.user_id ? personName(row) : (row.holder_label ?? "Turno fijo") },
        weekday: weekdayAt(row.weekday),
        time: hhmm(row.start_minute),
        durationMin: row.duration_minutes === 60 ? 60 : 90,
        courtId: row.court_id,
        status: statusOf(row),
        since: iso(row.starts_on).slice(0, 10),
        price: pesos(price),
        rejection: row.rejection_reason ? { reason: row.rejection_reason } : undefined,
      };
    })
    .filter((slot) => !status || slot.status === status);
}

export async function getFixedSlotCounts() {
  const slots = await listFixedSlots();
  const active = slots.filter((slot) => slot.status === "activo");
  return {
    active: active.length,
    requests: slots.filter((slot) => slot.status === "pedido").length,
    weeklyIncome: active.reduce((sum, slot) => sum + slot.price, 0),
  };
}
