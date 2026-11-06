import "server-only";

import { sql } from "@/lib/db/sql";

import { categoryOf, iso, personName, pesos } from "../rows";
import type { Member } from "../types";

export type MemberTotals = { active: number; newThisMonth: number; preRegistered: number };

type MemberRow = {
  id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  category: number | null;
  category_verified: boolean;
  side: "drive" | "reves" | "ambos" | null;
  status: "active" | "suspended";
  onboarding_completed_at: Date | null;
  last_seen_at: Date | null;
  created_at: Date;
  matches_played: number;
  bookings_count: number;
  cancellations: number;
  paid_cents: string;
  notifications_on: boolean;
  blocked: { at: string; reason?: string } | null;
};

const NEW_DAYS = 30;

function toMember(row: MemberRow): Member {
  const status: Member["status"] =
    row.status === "suspended"
      ? "bloqueado"
      : !row.onboarding_completed_at
        ? "preinscripto"
        : !row.category
          ? "sin-categoria"
          : Date.now() - row.created_at.getTime() < NEW_DAYS * 86_400_000
            ? "nuevo"
            : "activo";
  return {
    id: row.id,
    name: personName(row),
    email: row.email ?? undefined,
    phone: row.phone ?? undefined,
    category: categoryOf(row.category),
    categoryChosenBy: row.category ? (row.category_verified ? "club" : "socio") : undefined,
    side: row.side === "ambos" ? "indistinto" : (row.side ?? undefined),
    status,
    memberSince: iso(row.created_at),
    lastActivity: row.last_seen_at ? iso(row.last_seen_at) : undefined,
    matchesPlayed: row.matches_played,
    bookingsCount: row.bookings_count,
    cancellations: row.cancellations,
    paidThisYear: pesos(row.paid_cents),
    usesApp: true,
    notificationsOn: row.notifications_on,
    blocked: row.status === "suspended" ? { at: iso(row.blocked?.at ?? row.created_at), reason: row.blocked?.reason ?? "Bloqueado por el club" } : undefined,
  };
}

async function queryMembers(where: (db: ReturnType<typeof sql>) => ReturnType<ReturnType<typeof sql>>): Promise<Member[]> {
  const db = sql();
  const rows = await db<MemberRow[]>`
    select u.id, u.first_name, u.last_name, u.display_name, u.email, u.phone, u.category,
           u.category_verified, u.side, u.status, u.onboarding_completed_at, u.last_seen_at, u.created_at,
           (select count(*)::int from app.match_participants mp where mp.user_id = u.id) as matches_played,
           (select count(*)::int from app.court_occupancy o
             where o.user_id = u.id and o.kind = 'booking' and o.status in ('confirmed', 'completed')) as bookings_count,
           (select count(*)::int from app.court_occupancy o
             where o.user_id = u.id and o.kind = 'booking' and o.status = 'cancelled') as cancellations,
           (select coalesce(sum(p.amount_cents), 0) from app.payment_intents p
             where p.user_id = u.id and p.status = 'approved' and p.approved_at >= date_trunc('year', now())) as paid_cents,
           exists (select 1 from app.user_devices d where d.user_id = u.id and d.push_token is not null) as notifications_on,
           (select json_build_object('at', a.occurred_at, 'reason', a.metadata->>'reason') from app.audit_log a
             where a.entity_type = 'user' and a.entity_id = u.id::text and a.action = 'member.blocked'
             order by a.occurred_at desc limit 1) as blocked
    from app.users u
    where u.deleted_at is null and ${where(db)}
    order by u.last_seen_at desc nulls last, u.created_at desc`;
  return rows.map(toMember);
}

export async function listMembers(): Promise<Member[]> {
  return queryMembers((db) => db`true`);
}

export async function getMember(id: string): Promise<Member | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [member] = await queryMembers((db) => db`u.id = ${id}`);
  return member ?? null;
}

export async function getMemberTotals(): Promise<MemberTotals> {
  const [totals] = await sql()<MemberTotals[]>`
    select count(*) filter (where status = 'active' and onboarding_completed_at is not null)::int as "active",
           count(*) filter (where created_at >= date_trunc('month', now()))::int as "newThisMonth",
           count(*) filter (where onboarding_completed_at is null)::int as "preRegistered"
    from app.users where deleted_at is null`;
  return totals!;
}
