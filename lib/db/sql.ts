import "server-only";

import { randomBytes } from "node:crypto";

import postgres from "postgres";

/*
 * The club's database (in-api's Postgres on Supabase), as the `in_web_panel` role: it reads what
 * the panel shows and writes only what its actions change. Effects (notifying a member, refunding a
 * deposit, refreshing availability or the club cache) are in-api's job: actions publish the event
 * in `app.outbox_events` in the same transaction (./outbox.ts) and in-api's relay processes it.
 */

const globalForSql = globalThis as unknown as { __inGorinaSql?: postgres.Sql };

/** Lazy, so `next build` doesn't need the database. One pool per server (survives dev reloads). */
export function sql(): postgres.Sql {
  if (!globalForSql.__inGorinaSql) {
    const url = process.env.DATABASE_URL;
    if (!url) throw new Error("Falta DATABASE_URL (rol in_web_panel) en .env.local.");
    globalForSql.__inGorinaSql = postgres(url, { max: 3, idle_timeout: 30, prepare: false, onnotice: () => undefined });
  }
  return globalForSql.__inGorinaSql;
}

export type Tx = postgres.TransactionSql;

export function withTx<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
  return sql().begin(run) as Promise<T>;
}

/** UUIDv7, like in-api's ids: time-ordered, so the outbox relay processes events in order. */
export function newId(): string {
  const bytes = randomBytes(16);
  // 48-bit millisecond timestamp, big-endian.
  bytes.writeUIntBE(Date.now(), 0, 6);
  bytes[6] = (bytes[6]! & 0x0f) | 0x70;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
