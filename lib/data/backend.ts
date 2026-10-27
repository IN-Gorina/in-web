/*
 * Every feature in lib/data/<feature>/service.ts reads through these helpers. While there is no
 * backend, services return the mock data in memory. Connecting the backend means rewriting the
 * services, without touching screens (same approach as in-app/src/features/*).
 */

export const isMockBackend = true;

/**
 * The mock club lives on Thursday 8 October 2026 at 18:10, the moment the Paper designs show.
 * A fixed date also keeps pages prerenderable (cacheComponents is on).
 */
export const MOCK_NOW = new Date("2026-10-08T18:10:00-03:00");

/** Resolves on the next tick, so callers already handle data as async. */
export function mockResponse<T>(value: T): Promise<T> {
  return Promise.resolve(structuredClone(value));
}
