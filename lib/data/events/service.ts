import "server-only";

import { sql } from "@/lib/db/sql";

import { categoryOf, iso, personName, pesos } from "../rows";
import type { ClubEvent } from "../types";

type EventRow = {
  id: string;
  tag: string;
  title: string;
  about: string;
  starts_at: Date;
  ends_at: Date;
  price_cents: string | null;
  capacity: number;
  registered: number;
  hero_url: string | null;
  thumbnail_url: string | null;
  active: boolean;
  attendees: { user_id: string; first_name: string | null; last_name: string | null; display_name: string | null; email: string | null; category: number | null }[];
};

function toEvent(row: EventRow): ClubEvent {
  return {
    id: row.id,
    title: row.title,
    type: row.tag,
    start: iso(row.starts_at),
    end: iso(row.ends_at),
    courtIds: [],
    pricePerPerson: pesos(row.price_cents),
    capacity: row.capacity,
    attendees: row.attendees.map((a) => ({
      memberId: a.user_id,
      name: personName(a),
      detail: categoryOf(a.category) ?? "Sin categoría",
      paid: "en-club",
    })),
    registered: row.registered,
    status: !row.active ? "cancelado" : row.ends_at < new Date() ? "pasado" : "publicado",
    image: row.hero_url ?? row.thumbnail_url ?? undefined,
    description: row.about,
    blockCourts: false,
  };
}

async function queryEvents(where: (db: ReturnType<typeof sql>) => ReturnType<ReturnType<typeof sql>>): Promise<ClubEvent[]> {
  const db = sql();
  const rows = await db<EventRow[]>`
    select e.id, e.tag, e.title, e.about, e.starts_at, e.ends_at, e.price_cents, e.capacity, e.registered,
           e.hero_url, e.thumbnail_url, e.active,
           coalesce((select json_agg(json_build_object('user_id', u.id, 'first_name', u.first_name, 'last_name', u.last_name,
                                                       'display_name', u.display_name, 'email', u.email, 'category', u.category)
                                     order by r.registered_at)
                     from app.event_registrations r join app.users u on u.id = r.user_id
                     where r.event_id = e.id), '[]') as attendees
    from app.club_events e
    where ${where(db)}
    order by e.starts_at`;
  return rows.map(toEvent);
}

export async function listEvents(): Promise<ClubEvent[]> {
  return queryEvents((db) => db`true`);
}

export async function getEvent(id: string): Promise<ClubEvent | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [event] = await queryEvents((db) => db`e.id = ${id}`);
  return event ?? null;
}
