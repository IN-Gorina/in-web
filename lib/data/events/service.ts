import "server-only";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { ClubEvent } from "../types";

export async function listEvents(): Promise<ClubEvent[]> {
  return mockResponse(
    [...db().events].sort((a, b) => (a.start ?? "9999").localeCompare(b.start ?? "9999")),
  );
}

export async function getEvent(id: string): Promise<ClubEvent | null> {
  return mockResponse(db().events.find((event) => event.id === id) ?? null);
}
