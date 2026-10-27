import "server-only";

import * as seed from "./seed";

/*
 * In-memory database for the mock backend. Lives on globalThis so it survives module reloads in
 * development; it resets when the server restarts. Only services and actions touch it.
 */

function createStore() {
  return {
    courts: structuredClone(seed.seedCourts),
    members: structuredClone(seed.seedMembers),
    bookings: structuredClone(seed.seedBookings),
    blocks: structuredClone(seed.seedBlocks),
    payments: structuredClone(seed.seedPayments),
    fixedSlots: structuredClone(seed.seedFixedSlots),
    events: structuredClone(seed.seedEvents),
    reports: structuredClone(seed.seedReports),
    notifications: structuredClone(seed.seedNotifications),
    staff: structuredClone(seed.seedStaff),
    rates: structuredClone(seed.seedRates),
    rules: structuredClone(seed.seedRules),
    settings: structuredClone(seed.seedSettings),
  };
}

export type MockStore = ReturnType<typeof createStore>;

const globalForStore = globalThis as unknown as { __inGorinaStore?: MockStore };

export function db(): MockStore {
  globalForStore.__inGorinaStore ??= createStore();
  return globalForStore.__inGorinaStore;
}

let counter = 0;
export function newId(prefix: string): string {
  counter += 1;
  return `${prefix}-${Date.now().toString(36)}-${counter}`;
}
