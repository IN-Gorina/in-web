import "server-only";

import { sql } from "@/lib/db/sql";

/** Counts behind the red badges in the sidebar. */
export type AttentionCounts = {
  fixedSlotRequests: number;
  openReports: number;
};

export async function getAttentionCounts(): Promise<AttentionCounts> {
  const [counts] = await sql()<AttentionCounts[]>`
    select
      (select count(*)::int from app.recurring_bookings where status = 'pending') as "fixedSlotRequests",
      (select count(*)::int from (
         select r.target_id from app.content_reports r join app.posts p on p.id = r.target_id
         where r.target_type = 'post' and p.status <> 'hidden'
         group by r.target_id
         having max(r.created_at) > coalesce((
           select max(a.occurred_at) from app.audit_log a
           where a.action = 'report.dismissed' and a.entity_type = 'post' and a.entity_id = r.target_id::text), '-infinity')
       ) open) as "openReports"`;
  return counts!;
}
