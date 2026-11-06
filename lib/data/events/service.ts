import "server-only";

import { sql } from "@/lib/db/sql";

import { categoryOf, iso, loadClub, personName, pesos } from "../rows";
import type { Category, ClubEvent, EventAudience } from "../types";
import { categoryNumber, sexFromDb, sexToDb } from "./audience";

type EventRow = {
  id: string;
  tag: string;
  title: string;
  about: string;
  place: string;
  starts_at: Date;
  ends_at: Date;
  price_cents: string | null;
  capacity: number;
  registered: number;
  hero_url: string | null;
  thumbnail_url: string | null;
  active: boolean;
  published_at: Date | null;
  updated_at: Date;
  audience_categories: number[] | null;
  audience_sex: string | null;
  notify_title: string | null;
  notify_body: string | null;
  notify_at: Date | null;
  notified_at: Date | null;
  attendees: { user_id: string; first_name: string | null; last_name: string | null; display_name: string | null; email: string | null; category: number | null }[];
};

function toEvent(row: EventRow, courts: { id: string; name: string }[]): ClubEvent {
  // The panel writes the chosen courts' names into `place` ("Cancha 1 y Cancha 2").
  const placeNames = row.place.split(/, | y /);
  return {
    id: row.id,
    title: row.title,
    type: row.tag,
    start: iso(row.starts_at),
    end: iso(row.ends_at),
    courtIds: courts.filter((c) => placeNames.includes(c.name)).map((c) => c.id),
    audience: {
      categories: row.audience_categories?.map((c) => categoryOf(c)).filter((c): c is Category => c !== undefined) ?? null,
      sex: sexFromDb(row.audience_sex) ?? null,
    },
    notification:
      row.notify_title && row.notify_body
        ? { title: row.notify_title, body: row.notify_body, at: row.notify_at ? iso(row.notify_at) : null, sentAt: row.notified_at ? iso(row.notified_at) : null }
        : null,
    pricePerPerson: pesos(row.price_cents),
    capacity: row.capacity,
    attendees: row.attendees.map((a) => ({
      memberId: a.user_id,
      name: personName(a),
      detail: categoryOf(a.category) ?? "Sin categoría",
      paid: "en-club",
    })),
    registered: row.registered,
    status: !row.active ? "cancelado" : !row.published_at ? "borrador" : row.ends_at < new Date() ? "pasado" : "publicado",
    image: row.hero_url ?? row.thumbnail_url ?? undefined,
    description: row.about,
    editedAt: iso(row.updated_at),
    blockCourts: false,
  };
}

async function queryEvents(where: (db: ReturnType<typeof sql>) => ReturnType<ReturnType<typeof sql>>): Promise<ClubEvent[]> {
  const db = sql();
  const [rows, { courts }] = await Promise.all([
    db<EventRow[]>`
      select e.id, e.tag, e.title, e.about, e.place, e.starts_at, e.ends_at, e.price_cents, e.capacity, e.registered,
             e.hero_url, e.thumbnail_url, e.active, e.published_at, e.updated_at, e.audience_categories, e.audience_sex,
             e.notify_title, e.notify_body, e.notify_at, e.notified_at,
             coalesce((select json_agg(json_build_object('user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
                                                         'display_name', u.display_name, 'email', u.email, 'category', u.category)
                                       order by r.registered_at)
                       from app.event_registrations r join app.users u on u.id = r.user_id
                       where r.event_id = e.id), '[]') as attendees
      from app.club_events e
      where ${where(db)}
      order by e.starts_at`,
    loadClub(),
  ]);
  return rows.map((row) => toEvent(row, courts));
}

export async function listEvents(): Promise<ClubEvent[]> {
  return queryEvents((db) => db`true`);
}

export async function getEvent(id: string): Promise<ClubEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [event] = await queryEvents((db) => db`e.id = ${id}`);
  return event ?? null;
}

/**
 * Members the event's notification reaches: in the audience (the same rule as in-api) and with
 * push on in some device.
 */
export async function countAudience(audience: EventAudience): Promise<{ members: number; withPush: number }> {
  const categories = audience.categories?.map(categoryNumber) ?? null;
  const [count] = await sql()<{ members: number; with_push: number }[]>`
    select count(*)::int as members,
           count(*) filter (where exists (select 1 from app.user_devices d where d.user_id = u.id and d.push_token is not null))::int as with_push
    from app.users u
    where u.deleted_at is null and u.status = 'active' and u.onboarding_completed_at is not null
      and u.firebase_uid not like 'system:%'
      and (${categories}::smallint[] is null or u.category = any(${categories}::smallint[]))
      and (${sexToDb(audience.sex)}::app.user_sex is null or u.sex = ${sexToDb(audience.sex)}::app.user_sex)`;
  return { members: count!.members, withPush: count!.with_push };
}
