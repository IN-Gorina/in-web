import "server-only";

import type postgres from "postgres";

import type { StaffMember } from "@/lib/data/types";

import { newId, type Tx } from "./sql";

/**
 * Publishes a domain event for in-api, in the caller's transaction: if it rolls back, the event
 * never existed. Topics and payloads must match what in-api's own services emit.
 */
export async function emit(tx: Tx, event: { topic: string; aggregateType: string; aggregateId: string; payload: Record<string, unknown> }) {
  await tx`
    insert into app.outbox_events (id, topic, aggregate_type, aggregate_id, payload)
    values (${newId()}, ${event.topic}, ${event.aggregateType}, ${event.aggregateId}, ${tx.json(event.payload as postgres.JSONValue)})`;
}

/** Audit trail of what the staff changed. Staff are Firebase users, not app users: actor_type system. */
export async function audit(tx: Tx, staff: StaffMember, action: string, entity: { type: string; id: string }, metadata: Record<string, unknown> = {}) {
  await tx`
    insert into app.audit_log (id, actor_type, actor_id, action, entity_type, entity_id, metadata)
    values (${newId()}, 'system', null, ${action}, ${entity.type}, ${entity.id},
            ${tx.json({ ...metadata, panel: { uid: staff.id, email: staff.email, role: staff.role } })})`;
}

/** in-api topics the panel publishes (see in-api libs/booking/src/domain/events.ts, libs/club). */
export const topics = {
  occupancyChanged: "occupancy.changed",
  bookingCancelled: "booking.cancelled",
  fixedSlotDecided: "fixed_slot.decided",
  clubConfigChanged: "club.config.changed",
} as const;
