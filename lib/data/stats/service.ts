import "server-only";

import { connection } from "next/server";

import { monthName, now, weekdayLabels } from "@/lib/dates";
import { sql } from "@/lib/db/sql";

import { getAttentionCounts } from "../attention/service";
import { getBookingRules } from "../club/service";
import { listFixedSlots } from "../fixed-slots/service";
import { loadClub, pesos } from "../rows";

export type AttentionItem = {
  tone: "warning" | "info" | "neutral" | "success";
  title: string;
  detail: string;
  href: string;
};

export type DashboardStats = {
  month: string;
  revenue: { value: number; delta: string };
  occupancy: { value: number; delta: string };
  members: { value: number; detail: string };
  cancellations: { value: number; detail: string };
  heatmap: { bands: string[]; days: string[]; levels: number[][]; insight: string };
  weeklyRevenue: { label: string; value: number; current: boolean }[];
  attention: AttentionItem[];
};

const BANDS = ["8–10", "10–12", "12–14", "14–16", "16–18", "18–20", "20–22", "22–24"];
const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

type MonthRow = { revenue: string; prev_revenue: string; booked_minutes: number; prev_booked_minutes: number; cancelled: number; expired: number; total: number };

const delta = (current: number, previous: number, unit: "%" | "pts", label: string) => {
  if (unit === "pts") return `${current - previous >= 0 ? "+" : ""}${current - previous} pts vs ${label}`;
  if (!previous) return `sin datos de ${label}`;
  const change = Math.round(((current - previous) / previous) * 100);
  return `${change >= 0 ? "+" : ""}${change}% vs ${label}`;
};

export async function getDashboard(): Promise<DashboardStats> {
  await connection();
  const db = sql();
  const today = now();
  const [{ courts, hours }, rules, counts, requests, [month], [members], heat, weeks, [pending]] = await Promise.all([
    loadClub(),
    getBookingRules(),
    getAttentionCounts(),
    listFixedSlots("pedido"),
    db<MonthRow[]>`
      select
        coalesce(sum(price_cents) filter (where status in ('confirmed', 'completed') and lower(period) >= date_trunc('month', now())), 0) as revenue,
        coalesce(sum(price_cents) filter (where status in ('confirmed', 'completed') and lower(period) < date_trunc('month', now())), 0) as prev_revenue,
        coalesce(sum(extract(epoch from upper(period) - lower(period)) / 60) filter (
          where status in ('confirmed', 'completed') and lower(period) >= date_trunc('month', now()) and lower(period) < now()), 0)::int as booked_minutes,
        coalesce(sum(extract(epoch from upper(period) - lower(period)) / 60) filter (
          where status in ('confirmed', 'completed') and lower(period) < date_trunc('month', now())), 0)::int as prev_booked_minutes,
        count(*) filter (where status = 'cancelled' and lower(period) >= date_trunc('month', now()))::int as cancelled,
        count(*) filter (where status = 'expired' and lower(period) >= date_trunc('month', now()))::int as expired,
        count(*) filter (where lower(period) >= date_trunc('month', now()))::int as total
      from app.court_occupancy
      where kind in ('booking', 'recurring') and lower(period) >= date_trunc('month', now()) - interval '1 month'
        and lower(period) < date_trunc('month', now()) + interval '1 month'`,
    db<{ active: number; new: number; pre: number }[]>`
      select count(*) filter (where status = 'active' and onboarding_completed_at is not null)::int as active,
             count(*) filter (where created_at >= date_trunc('month', now()))::int as new,
             count(*) filter (where onboarding_completed_at is null)::int as pre
      from app.users where deleted_at is null`,
    // Last 4 weeks: booked minutes per weekday (0 = Monday) and two-hour band from 8:00.
    db<{ weekday: number; band: number; minutes: number }[]>`
      select (extract(isodow from lower(period) at time zone 'America/Argentina/Buenos_Aires')::int - 1) as weekday,
             floor((extract(hour from lower(period) at time zone 'America/Argentina/Buenos_Aires') - 8) / 2)::int as band,
             sum(extract(epoch from upper(period) - lower(period)) / 60)::int as minutes
      from app.court_occupancy
      where kind in ('booking', 'recurring') and status in ('confirmed', 'completed')
        and lower(period) >= now() - interval '28 days' and lower(period) < now()
      group by 1, 2`,
    db<{ week: number; revenue: string }[]>`
      select floor(extract(epoch from now() - lower(period)) / 604800)::int as week, sum(price_cents) as revenue
      from app.court_occupancy
      where kind in ('booking', 'recurring') and status in ('confirmed', 'completed')
        and lower(period) >= now() - interval '28 days' and lower(period) < now()
      group by 1`,
    db<{ count: number }[]>`select count(*)::int as count from app.court_occupancy where status = 'held' and hold_expires_at > now()`,
  ]);

  const activeCourts = courts.filter((court) => court.active).length || 1;
  const openMinutesPerDay = (weekday: number) => hours.filter((h) => h.weekday === weekday).reduce((sum, h) => sum + h.close_minute - h.open_minute, 0);
  const averageOpen = [0, 1, 2, 3, 4, 5, 6].reduce((sum, d) => sum + openMinutesPerDay(d), 0) / 7 || 1;
  const daysThisMonth = today.getDate();
  const occupancy = Math.min(100, Math.round((month!.booked_minutes / (activeCourts * averageOpen * daysThisMonth)) * 100));
  const prevDays = new Date(today.getFullYear(), today.getMonth(), 0).getDate();
  const prevOccupancy = Math.min(100, Math.round((month!.prev_booked_minutes / (activeCourts * averageOpen * prevDays)) * 100));
  const previousLabel = monthName(new Date(today.getFullYear(), today.getMonth() - 1, 15));

  // 4 weeks × 2 hours × courts = capacity of each heatmap cell.
  const cellCapacity = 4 * 120 * activeCourts;
  const levels = DAYS.map((_, weekday) =>
    BANDS.map((__, band) => {
      const minutes = heat.find((cell) => cell.weekday === weekday && cell.band === band)?.minutes ?? 0;
      return Math.min(4, Math.round((minutes / cellCapacity) * 4));
    }),
  );
  const quiet = levels.flatMap((row, d) => row.map((level, b) => ({ level, d, b }))).filter((cell) => cell.d < 5 && cell.b >= 1 && cell.b <= 3);
  const quietShare = quiet.length ? Math.round((quiet.reduce((sum, c) => sum + c.level, 0) / (quiet.length * 4)) * 100) : 0;

  const attention: AttentionItem[] = [];
  if (pending!.count > 0)
    attention.push({
      tone: "warning",
      title: `${pending!.count} ${pending!.count === 1 ? "seña" : "señas"} por vencer`,
      detail: `Si no se pagan en ${rules.depositMinutes} min, el turno se libera solo`,
      href: "/reservas?estado=sena-pendiente",
    });
  if (requests.length > 0)
    attention.push({
      tone: "info",
      title: `${requests.length} ${requests.length === 1 ? "pedido" : "pedidos"} de turno fijo`,
      detail: requests.map((slot) => `${slot.holder.name.split(" ")[0]} · ${weekdayLabels[slot.weekday].short} ${slot.time}`).join(" · "),
      href: "/turnos-y-partidos",
    });
  if (counts.openReports > 0)
    attention.push({
      tone: "success",
      title: `${counts.openReports} ${counts.openReports === 1 ? "publicación denunciada" : "publicaciones denunciadas"}`,
      detail: "Revisalas en Moderación",
      href: "/moderacion",
    });

  const revenue = pesos(month!.revenue);
  const cancelledShare = month!.total ? Math.round(((month!.cancelled + month!.expired) / month!.total) * 100) : 0;
  return {
    month: monthName(today),
    revenue: { value: revenue, delta: delta(revenue, pesos(month!.prev_revenue), "%", previousLabel) },
    occupancy: { value: occupancy, delta: delta(occupancy, prevOccupancy, "pts", previousLabel) },
    members: { value: members!.active, detail: `+${members!.new} este mes · ${members!.pre} pre-inscriptos` },
    cancellations: { value: month!.cancelled + month!.expired, detail: `${cancelledShare}% del mes · ${month!.expired} vencieron sin seña` },
    heatmap: { bands: BANDS, days: DAYS, levels, insight: `Mediodías de semana: ${quietShare}% de ocupación` },
    weeklyRevenue: [3, 2, 1, 0].map((week) => ({
      label: week === 0 ? "Esta" : `Sem ${4 - week}`,
      // Thousands of pesos, as the chart shows.
      value: Math.round(pesos(weeks.find((w) => w.week === week)?.revenue) / 1000),
      current: week === 0,
    })),
    attention,
  };
}
