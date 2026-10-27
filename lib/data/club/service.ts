import "server-only";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { BookingRules, ClubSettings, Court, RateBand } from "../types";
import type { PricingTable } from "./pricing";

export async function getCourts(): Promise<Court[]> {
  return mockResponse(db().courts);
}

export async function getRates(): Promise<RateBand[]> {
  return mockResponse(db().rates);
}

export async function getBookingRules(): Promise<BookingRules> {
  return mockResponse(db().rules);
}

export async function getClubSettings(): Promise<ClubSettings> {
  return mockResponse(db().settings);
}

export async function getPricing(): Promise<PricingTable> {
  return mockResponse({ rates: db().rates, depositAmount: db().rules.depositAmount });
}
