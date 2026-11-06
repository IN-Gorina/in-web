"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { now, toIso } from "@/lib/dates";
import { audit, emit, topics } from "@/lib/db/outbox";
import { newId, type Tx } from "@/lib/db/sql";

import { loadClub } from "../rows";
import type { Category, EventAudience } from "../types";
import { categories } from "../types";
import { withTx } from "../writes";
import { audienceLabel, categoryNumber, sexToDb } from "./audience";
import { countAudience } from "./service";

const refresh = () => revalidatePath("/", "layout");

export type EventNotificationInput = {
  title: string;
  body: string;
  /** null = when the event is published; else "YYYY-MM-DD" and "HH:mm" in club time. */
  schedule: { day: string; time: string } | null;
};

export type EventInput = {
  id?: string;
  title: string;
  type: string;
  capacity: number;
  day: string; // YYYY-MM-DD
  from: string;
  to: string;
  pricePerPerson: number;
  courtIds: string[];
  description: string;
  audience: EventAudience;
  /** null = no notification. */
  notification: EventNotificationInput | null;
  publish: boolean;
};

/*
 * Events live in in-api's club_events: the panel writes them with key `panel-<id>`. Everyone sees
 * a published event in the app; only its audience can sign up. in-api sends the notification
 * once, to the audience only: right away when published, or at `notify_at` (portal.notify-events,
 * every minute) when scheduled.
 */

/** "Cancha 1 y Cancha 2", "Cancha 1, Cancha 2 y Cancha 3"; the service reads the courts back from it. */
function placeOf(names: string[]) {
  if (names.length === 0) return "Club";
  return names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;
}

function validAudience(audience: EventAudience) {
  const chosen = audience.categories;
  if (chosen !== null && (chosen.length === 0 || chosen.some((c) => !categories.includes(c as Category)))) {
    throw new Error("Elegí al menos una categoría, o «Todas».");
  }
  return { categories: chosen?.map(categoryNumber).sort((a, b) => a - b) ?? null, sex: sexToDb(audience.sex) };
}

/** Members the notification would reach, for the form ("Llega a 42 socios"). */
export async function previewAudience(audience: EventAudience): Promise<ActionResult<{ members: number; withPush: number; label: string }>> {
  return runAction("reservas.gestionar", async () => {
    validAudience(audience);
    return { ...(await countAudience(audience)), label: audienceLabel(audience) };
  });
}

export async function saveEvent(input: EventInput): Promise<ActionResult<{ id: string; notification: { at: string; withPush: number } | null }>> {
  return runAction("reservas.gestionar", async (staff) => {
    const title = input.title.trim();
    const about = input.description.trim();
    if (title.length < 2 || title.length > 80) throw new Error("Escribí el título (hasta 80 letras).");
    if (!input.type) throw new Error("Elegí el tipo de evento.");
    if (!Number.isInteger(input.capacity) || input.capacity < 1 || input.capacity > 1000) throw new Error("El cupo va de 1 a 1000.");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.day) || !input.from || !input.to) throw new Error("Elegí la fecha y el horario.");
    if (input.to <= input.from) throw new Error("La hora de fin tiene que ser después de la de inicio.");
    if (about.length < 2) throw new Error("Escribí la descripción: la ven los socios.");
    const startsAt = new Date(toIso(input.day, input.from));
    const endsAt = new Date(toIso(input.day, input.to));
    if (input.publish && endsAt <= now()) throw new Error("No se puede publicar un evento que ya terminó.");
    const audience = validAudience(input.audience);

    const notification = input.notification;
    let notifyAt: Date | null = null;
    if (notification) {
      if (notification.title.trim().length < 1 || notification.title.trim().length > 60) throw new Error("Escribí el título de la notificación (hasta 60 letras).");
      if (notification.body.trim().length < 1 || notification.body.trim().length > 140) throw new Error("Escribí el mensaje de la notificación (hasta 140 letras).");
      if (notification.schedule) {
        notifyAt = new Date(toIso(notification.schedule.day, notification.schedule.time));
        if (notifyAt <= now()) throw new Error("La hora del aviso ya pasó. Elegí una más tarde.");
        if (notifyAt >= endsAt) throw new Error("El aviso tiene que salir antes de que termine el evento.");
      } else if (input.publish) {
        notifyAt = now(); // sale ya (writeNotification)
      }
    }

    const { courts } = await loadClub();
    const place = placeOf(courts.filter((c) => input.courtIds.includes(c.id)).map((c) => c.name));
    // The app shows the first sentence in the list.
    const summary = (about.split(/(?<=[.!?])\s/)[0] ?? about).slice(0, 200);
    const priceCents = input.pricePerPerson > 0 ? Math.round(input.pricePerPerson * 100) : null;

    const id = await withTx(async (tx) => {
      if (!input.id) {
        const eventId = newId();
        await tx`
          insert into app.club_events (id, key, tag, title, summary, about, place, starts_at, ends_at, price_cents, capacity,
                                       audience_categories, audience_sex, published_at)
          values (${eventId}, ${`panel-${eventId}`}, ${input.type}, ${title}, ${summary}, ${about}, ${place}, ${startsAt}, ${endsAt},
                  ${priceCents}, ${input.capacity}, ${audience.categories}::smallint[], ${audience.sex}::app.user_sex,
                  ${input.publish ? now() : null}::timestamptz)`;
        await writeNotification(tx, eventId, notification, notifyAt, input.publish);
        await audit(tx, staff, input.publish ? "event.published" : "event.draft_saved", { type: "event", id: eventId }, { title, audience: audienceLabel(input.audience) });
        return eventId;
      }
      const [current] = await tx<{ registered: number; published_at: Date | null; notified_at: Date | null }[]>`
        select registered, published_at, notified_at from app.club_events where id = ${input.id} and active for update`;
      if (!current) throw new Error("Ese evento ya no existe o se canceló.");
      if (input.capacity < current.registered) throw new Error(`Ya hay ${current.registered} anotados: el cupo no puede ser menor.`);
      await tx`
        update app.club_events
        set tag = ${input.type}, title = ${title}, summary = ${summary}, about = ${about}, place = ${place},
            starts_at = ${startsAt}, ends_at = ${endsAt}, price_cents = ${priceCents}, capacity = ${input.capacity},
            audience_categories = ${audience.categories}::smallint[], audience_sex = ${audience.sex}::app.user_sex,
            published_at = coalesce(published_at, ${input.publish ? now() : null}::timestamptz), updated_at = now()
        where id = ${input.id}`;
      // An already sent notification stays as it was.
      if (current.notified_at) notifyAt = null;
      else await writeNotification(tx, input.id, notification, notifyAt, input.publish);
      await audit(tx, staff, current.published_at || !input.publish ? "event.updated" : "event.published", { type: "event", id: input.id }, { title, audience: audienceLabel(input.audience) });
      return input.id;
    });
    refresh();
    const withPush = notifyAt ? (await countAudience(input.audience)).withPush : 0;
    return { id, notification: notifyAt ? { at: notifyAt.toISOString(), withPush } : null };
  });
}

/**
 * Stores the notification. One due now goes out right away: it is marked sent and in-api gets the
 * event in this transaction (its every-minute job only picks the scheduled ones still pending).
 */
async function writeNotification(tx: Tx, eventId: string, notification: EventNotificationInput | null, notifyAt: Date | null, publish: boolean) {
  const now = publish && notification !== null && notification.schedule === null && notifyAt !== null;
  await tx`
    update app.club_events
    set notify_title = ${notification?.title.trim() ?? null}, notify_body = ${notification?.body.trim() ?? null}, notify_at = ${notifyAt},
        notified_at = ${now ? notifyAt : null}
    where id = ${eventId}`;
  if (now) await emit(tx, { topic: topics.eventNotificationDue, aggregateType: "club_event", aggregateId: eventId, payload: { eventId } });
}

/** Hidden from the app and its pending notification dropped. Sign-ups stay (in-api never deletes them). */
export async function cancelEvent(id: string): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) =>
    withTx(async (tx) => {
      const [event] = await tx<{ title: string }[]>`
        update app.club_events set active = false, notify_at = case when notified_at is null then null else notify_at end, updated_at = now()
        where id = ${id} and active returning title`;
      if (!event) throw new Error("Ese evento ya no existe o se canceló.");
      await audit(tx, staff, "event.cancelled", { type: "event", id }, { title: event.title });
      refresh();
      return undefined;
    }),
  );
}

/** Signs a member up from the panel: same rules as the app (spots and audience). */
export async function registerAttendee(input: { eventId: string; memberId: string }): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) =>
    withTx(async (tx) => {
      const [event] = await tx<{ capacity: number; registered: number; ends_at: Date; audience_categories: number[] | null; audience_sex: string | null }[]>`
        select capacity, registered, ends_at, audience_categories, audience_sex from app.club_events
        where id = ${input.eventId} and active and published_at is not null for update`;
      if (!event) throw new Error("El evento no está publicado.");
      if (event.ends_at <= now()) throw new Error("El evento ya terminó.");
      const [member] = await tx<{ category: number | null; sex: string | null }[]>`
        select category, sex from app.users where id = ${input.memberId} and deleted_at is null and status = 'active'`;
      if (!member) throw new Error("No encontramos ese socio, o está bloqueado.");
      const inCategory = !event.audience_categories || (member.category !== null && event.audience_categories.includes(member.category));
      const inSex = !event.audience_sex || member.sex === event.audience_sex;
      if (!inCategory || !inSex) throw new Error("Ese socio no está en el público del evento (categoría o sexo).");
      if (event.registered >= event.capacity) throw new Error("No quedan lugares.");
      const added = await tx`
        insert into app.event_registrations (event_id, user_id) values (${input.eventId}, ${input.memberId})
        on conflict do nothing returning user_id`;
      if (added.length === 0) throw new Error("Ese socio ya está anotado.");
      await tx`update app.club_events set registered = registered + 1 where id = ${input.eventId}`;
      await audit(tx, staff, "event.attendee_added", { type: "event", id: input.eventId }, { memberId: input.memberId });
      refresh();
      return undefined;
    }),
  );
}
