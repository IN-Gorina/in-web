import "server-only";

import { shortDay, time } from "@/lib/dates";
import { sql } from "@/lib/db/sql";

import { iso, personName, pesos } from "../rows";
import type { Payment } from "../types";

/*
 * Online payments only: deposits through Mercado Pago (payment_intents) and their refunds.
 * Payments at the club aren't recorded anywhere yet.
 */

type PaymentRow = {
  id: string;
  kind: "intent" | "refund";
  status: string;
  amount_cents: string;
  at: Date;
  expires_at: Date | null;
  provider_payment_id: string | null;
  user_id: string;
  occupancy_id: string;
  starts_at: Date;
  court_name: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
};

function statusOf(row: PaymentRow): Payment["status"] {
  if (row.kind === "refund") return "reintegrado";
  if (row.status === "approved") return "acreditado";
  if (row.status === "refunded") return "reintegrado";
  if (row.status === "rejected") return "rechazado";
  return row.expires_at && row.expires_at.getTime() - Date.now() < 5 * 60_000 ? "vence-pronto" : "pendiente";
}

export async function listPayments(): Promise<Payment[]> {
  const rows = await sql()<PaymentRow[]>`
    select x.*, lower(o.period) as starts_at, c.name as court_name,
           u.first_name, u.last_name, u.display_name, u.email
    from (
      select p.id, 'intent' as kind, p.status::text, p.amount_cents, coalesce(p.approved_at, p.created_at) as at,
             p.expires_at, p.provider_payment_id, p.user_id, p.occupancy_id
      from app.payment_intents p where p.status <> 'expired'
      union all
      select f.id, 'refund', f.status::text, f.amount_cents, coalesce(f.completed_at, f.created_at),
             null, f.provider_refund_id, p.user_id, p.occupancy_id
      from app.payment_refunds f join app.payment_intents p on p.id = f.payment_intent_id
    ) x
    join app.court_occupancy o on o.id = x.occupancy_id
    join app.club_courts c on c.id = o.court_id
    join app.users u on u.id = x.user_id
    order by x.at desc
    limit 300`;
  return rows.map((row) => {
    const refund = row.kind === "refund";
    return {
      id: row.id,
      at: iso(row.at),
      memberName: personName(row),
      memberId: row.user_id,
      bookingId: row.occupancy_id,
      concept: "sena",
      title: `${row.court_name} · ${shortDay(row.starts_at)} · ${time(row.starts_at)}`,
      detail: refund ? "Devolución de la seña" : "Seña",
      method: "mercado-pago",
      status: statusOf(row),
      amount: refund ? -pesos(row.amount_cents) : pesos(row.amount_cents),
      operationId: row.provider_payment_id ?? undefined,
      manual: false,
    };
  });
}

export type PaymentTotals = {
  collected: number;
  depositsCount: number;
  balancesCount: number;
  pendingAmount: number;
  pendingCount: number;
  refundsAmount: number;
  refundsCount: number;
  mpFees: number;
};

/** This month's totals on Pagos. */
export async function getPaymentTotals(): Promise<PaymentTotals> {
  const [row] = await sql()<{ collected: string; deposits: number; pending: string; pending_count: number; refunds: string; refunds_count: number }[]>`
    select
      coalesce(sum(amount_cents) filter (where status in ('approved', 'refunded') and approved_at >= date_trunc('month', now())), 0) as collected,
      count(*) filter (where status in ('approved', 'refunded') and approved_at >= date_trunc('month', now()))::int as deposits,
      coalesce(sum(amount_cents) filter (where status = 'pending' and expires_at > now()), 0) as pending,
      count(*) filter (where status = 'pending' and expires_at > now())::int as pending_count,
      (select coalesce(sum(amount_cents), 0) from app.payment_refunds
        where status = 'succeeded' and completed_at >= date_trunc('month', now())) as refunds,
      (select count(*)::int from app.payment_refunds
        where status = 'succeeded' and completed_at >= date_trunc('month', now())) as refunds_count
    from app.payment_intents`;
  return {
    collected: pesos(row!.collected) - pesos(row!.refunds),
    depositsCount: row!.deposits,
    balancesCount: 0,
    pendingAmount: pesos(row!.pending),
    pendingCount: row!.pending_count,
    refundsAmount: pesos(row!.refunds),
    refundsCount: row!.refunds_count,
    mpFees: 0,
  };
}
