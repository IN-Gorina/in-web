"use server";

import { runAction, type ActionResult } from "@/lib/auth/guard";

import { NOT_AVAILABLE } from "../writes";


export type EventInput = {
  id?: string;
  title: string;
  type: string;
  capacity: number;
  day: string; // YYYY-MM-DD, empty for a draft without date
  from: string;
  to: string;
  pricePerPerson: number;
  courtIds: string[];
  description: string;
  image?: string;
  blockCourts: boolean;
  notifyMembers: boolean;
  publish: boolean;
};

// Events are loaded in in-api (events.yaml): the panel shows them and their sign-ups, read only.

const notAvailable = () =>
  runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });

export async function saveEvent(_input: EventInput): Promise<ActionResult<{ id: string; notified: number }>> {
  return notAvailable();
}

export async function cancelEvent(_id: string): Promise<ActionResult<{ refunded: number }>> {
  return notAvailable();
}

export async function notifyAttendees(_id: string): Promise<ActionResult<{ count: number }>> {
  return notAvailable();
}

export async function registerAttendee(_input: { eventId: string; memberId: string }): Promise<ActionResult> {
  return notAvailable();
}
