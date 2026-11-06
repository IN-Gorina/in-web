import "server-only";

import { sql } from "@/lib/db/sql";

import { iso, personName } from "../rows";
import type { Report } from "../types";

/*
 * Reported posts, one entry per post (Report.id is the post id). content_reports has no status:
 * a post is "oculta" when hidden, and "descartada" when the staff dismissed its reports after the
 * last one came in (audit_log `report.dismissed`).
 */

const reasonLabels: Record<string, string> = {
  spam: "Spam",
  offensive: "Ofensivo",
  harassment: "Acoso",
  inappropriate_image: "Imagen inapropiada",
  other: "Otro",
};

const categoryLabels: Record<string, string> = {
  padel: "Pádel",
  partidos: "Partidos",
  torneos: "Torneos",
  comunidad: "Comunidad",
  avisos: "Avisos",
};

type ReportRow = {
  id: string;
  body: string;
  category: string;
  status: "processing" | "published" | "rejected" | "hidden";
  author_id: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  email: string | null;
  reasons: { reason: string; count: number }[];
  count: number;
  first_at: Date;
  last_at: Date;
  dismissed_at: Date | null;
};

export async function listReports(): Promise<Report[]> {
  const rows = await sql()<ReportRow[]>`
    with grouped as (
      select target_id, count(*)::int as count, min(created_at) as first_at, max(created_at) as last_at
      from app.content_reports where target_type = 'post' group by target_id
    )
    select p.id, p.body, p.category, p.status, p.author_id,
           u.first_name, u.last_name, u.display_name, u.email,
           g.count, g.first_at, g.last_at,
           (select json_agg(json_build_object('reason', reason, 'count', n) order by n desc)
              from (select reason, count(*)::int as n from app.content_reports
                    where target_type = 'post' and target_id = p.id group by reason) r) as reasons,
           (select max(a.occurred_at) from app.audit_log a
              where a.action = 'report.dismissed' and a.entity_type = 'post' and a.entity_id = p.id::text) as dismissed_at
    from grouped g
    join app.posts p on p.id = g.target_id
    join app.users u on u.id = p.author_id
    order by g.last_at desc
    limit 200`;
  return rows.map((row) => {
    const reasons = row.reasons.map((r) => ({ label: reasonLabels[r.reason] ?? r.reason, count: r.count }));
    const status: Report["status"] =
      row.status === "hidden" ? "oculta" : row.dismissed_at && row.dismissed_at >= row.last_at ? "descartada" : "abierta";
    return {
      id: row.id,
      author: { memberId: row.author_id, name: personName(row) },
      context: categoryLabels[row.category] ?? row.category,
      excerpt: row.body.length > 90 ? `${row.body.slice(0, 90)}…` : row.body,
      body: row.body,
      reason: reasons[0]?.label ?? "Otro",
      reasons,
      count: row.count,
      createdAt: iso(row.first_at),
      status,
    };
  });
}
