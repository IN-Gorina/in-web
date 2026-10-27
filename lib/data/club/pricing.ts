import { time, weekdayOf } from "@/lib/dates";

import type { RateBand } from "../types";

/** Pricing data the client needs to show a price while a form is being filled. */
export type PricingTable = { rates: RateBand[]; depositAmount: number };

/**
 * Price of a booking from the rate bands. Rates are for a 90-minute turn; other durations are
 * proportional, rounded to $100.
 */
export function priceFor(rates: RateBand[], startIso: string, durationMin: number): { price: number; band?: RateBand } {
  const hhmm = time(startIso);
  const band = rates.find((rate) => hhmm >= rate.from && hhmm < rate.to) ?? rates.at(-1);
  if (!band) return { price: 0 };
  const weekday = weekdayOf(startIso);
  const base = weekday === "sab" ? band.saturday : weekday === "dom" ? band.sunday : band.weekday;
  return { price: Math.round((base * durationMin) / 90 / 100) * 100, band };
}
