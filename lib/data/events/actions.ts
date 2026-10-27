"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { minutesOf, nowIso, toIso } from "@/lib/dates";

import { db, newId } from "../mock/store";
import type { ClubEvent, CourtBlock } from "../types";

const refresh = () => revalidatePath("/", "layout");

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

function validate(input: EventInput) {
  if (input.title.trim().length < 3) throw new Error("Escribí un título.");
  if (!input.publish) return;
  if (!input.type) throw new Error("Elegí el tipo de evento.");
  if (!input.day || !input.from || !input.to) throw new Error("Para publicar, completá fecha y horario.");
  if (minutesOf(input.to) <= minutesOf(input.from) && input.to !== "00:00") throw new Error("El horario de fin tiene que ser después del inicio.");
  if (!Number.isInteger(input.capacity) || input.capacity < 2) throw new Error("El cupo tiene que ser de al menos 2 personas.");
  if (input.description.length > 600) throw new Error("La descripción puede tener hasta 600 caracteres.");
}

export async function saveEvent(input: EventInput): Promise<ActionResult<{ id: string; notified: number }>> {
  return runAction("reservas.gestionar", (staff) => {
    validate(input);
    const store = db();
    const existing = input.id ? store.events.find((e) => e.id === input.id) : undefined;
    const start = input.day && input.from ? toIso(input.day, input.from) : undefined;
    const end = input.day && input.to ? toIso(input.day, input.to) : undefined;

    const event: ClubEvent = {
      ...(existing ?? { id: newId("ev"), attendees: [], registered: 0 }),
      title: input.title.trim(),
      type: input.type || "Social",
      capacity: input.capacity,
      start,
      end,
      pricePerPerson: Math.max(0, Math.round(input.pricePerPerson)),
      courtIds: input.courtIds,
      description: input.description.trim(),
      image: input.image ?? existing?.image,
      blockCourts: input.blockCourts,
      status: input.publish ? "publicado" : existing?.status === "publicado" ? "publicado" : "borrador",
      editedAt: nowIso(),
    };
    if (existing) Object.assign(existing, event);
    else store.events.push(event);

    // Courts used by a published event are blocked in the agenda.
    store.blocks = store.blocks.filter((b) => b.id !== `bl-${event.id}`);
    if (event.status === "publicado" && event.blockCourts && start && end && event.courtIds.length) {
      const block: CourtBlock = {
        id: `bl-${event.id}`,
        courtIds: event.courtIds,
        start,
        end,
        reason: "evento",
        title: "Evento del club",
        note: event.title,
      };
      store.blocks.push(block);
    }

    let notified = 0;
    if (input.publish && input.notifyMembers) {
      notified = 412;
      store.notifications.push({
        id: newId("n"),
        title: event.title,
        body: event.description?.slice(0, 120) || "Nuevo evento del club. Anotate desde la app.",
        audienceLabel: "Todos",
        status: "enviada",
        at: nowIso(),
        recipients: notified,
      });
    }
    void staff;
    refresh();
    return { id: event.id, notified };
  });
}

export async function cancelEvent(id: string): Promise<ActionResult<{ refunded: number }>> {
  return runAction("reservas.gestionar", () => {
    const store = db();
    const event = store.events.find((e) => e.id === id);
    if (!event || event.status === "cancelado") throw new Error("Ese evento ya estaba cancelado.");
    event.status = "cancelado";
    store.blocks = store.blocks.filter((b) => b.id !== `bl-${event.id}`);
    refresh();
    return { refunded: event.registered };
  });
}

export async function notifyAttendees(id: string): Promise<ActionResult<{ count: number }>> {
  return runAction("reservas.gestionar", () => {
    const event = db().events.find((e) => e.id === id);
    if (!event) throw new Error("No encontramos el evento.");
    return { count: event.registered };
  });
}

export async function registerAttendee(input: { eventId: string; memberId: string }): Promise<ActionResult> {
  return runAction("reservas.gestionar", () => {
    const store = db();
    const event = store.events.find((e) => e.id === input.eventId);
    const member = store.members.find((m) => m.id === input.memberId);
    if (!event || !member) throw new Error("No encontramos el evento o el socio.");
    if (event.registered >= event.capacity) throw new Error("El evento ya está lleno.");
    if (event.attendees.some((a) => a.memberId === member.id)) throw new Error(`${member.name} ya está anotado.`);
    event.attendees.unshift({ memberId: member.id, name: member.name, detail: `${member.category ?? "Sin categoría"} · anotado en recepción`, paid: "en-club" });
    event.registered += 1;
    refresh();
    return undefined;
  });
}
