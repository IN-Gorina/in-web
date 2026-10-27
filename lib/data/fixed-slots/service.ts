import "server-only";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { FixedSlot, FixedSlotStatus } from "../types";

const order = ["lun", "mar", "mie", "jue", "vie", "sab", "dom"];

export async function listFixedSlots(status?: FixedSlotStatus): Promise<FixedSlot[]> {
  return mockResponse(
    db()
      .fixedSlots.filter((slot) => !status || slot.status === status)
      .sort((a, b) => order.indexOf(a.weekday) - order.indexOf(b.weekday) || a.time.localeCompare(b.time)),
  );
}

/** The design shows 18 active slots; the mock holds a sample, so the count adds the rest. */
export async function getFixedSlotCounts() {
  const slots = db().fixedSlots;
  const active = slots.filter((slot) => slot.status === "activo").length;
  return mockResponse({
    active: active + 11,
    requests: slots.filter((slot) => slot.status === "pedido").length,
    weeklyIncome: slots.filter((slot) => slot.status === "activo").reduce((sum, slot) => sum + slot.price, 0) + 287_000,
  });
}
