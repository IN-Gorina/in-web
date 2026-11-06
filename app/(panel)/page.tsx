import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { LinkButton } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { KpiCard, KpiRow } from "@/components/ui/kpi-card";
import { PageHeader } from "@/components/ui/page-header";
import { cn } from "@/lib/cn";
import { getCurrentStaff } from "@/lib/data/session/service";
import { getDashboard, type AttentionItem } from "@/lib/data/stats/service";
import { now } from "@/lib/dates";
import { formatCount, formatMoney } from "@/lib/format";

export const metadata: Metadata = { title: "Resumen" };

function greeting(date: Date) {
  const hour = Number(new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "numeric", hourCycle: "h23" }).format(date));
  if (hour < 13) return "Buen día";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function ResumenPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ResumenContent />
    </Suspense>
  );
}

async function ResumenContent() {
  await connection();
  const [staff, stats] = await Promise.all([getCurrentStaff(), getDashboard()]);

  return (
    <>
      <PageHeader
        title={`${greeting(now())}, ${staff.name.split(" ")[0]}`}
        subtitle={`Así viene el club en ${stats.month}`}
        actions={
          <LinkButton href="/agenda?nueva=1" icon="plus">
            Nueva reserva
          </LinkButton>
        }
      />

      <KpiRow>
        <KpiCard highlight label={`Ingresos de ${stats.month}`} value={formatMoney(stats.revenue.value)} footnote={stats.revenue.delta} />
        <KpiCard label="Ocupación promedio" value={`${stats.occupancy.value}%`} footnote={stats.occupancy.delta} trend="positive" />
        <KpiCard label="Socios activos" value={formatCount(stats.members.value)} footnote={stats.members.detail} trend="positive" />
        <KpiCard label="Reservas canceladas" value={String(stats.cancellations.value)} footnote={stats.cancellations.detail} />
      </KpiRow>

      <div className="flex min-h-0 flex-1 gap-4">
        <Heatmap heatmap={stats.heatmap} />
        <Card className="flex w-[380px] shrink-0 flex-col gap-3 p-5">
          <CardTitle title="Para atender hoy" />
          {stats.attention.length === 0 ? (
            <p className="text-label font-medium text-ink-muted">Nada pendiente por ahora.</p>
          ) : (
            stats.attention.map((item) => <AttentionRow key={item.title} item={item} />)
          )}
          <div className="flex-1" />
          <WeeklyRevenue weeks={stats.weeklyRevenue} />
        </Card>
      </div>
    </>
  );
}

const heatColors = ["#E1EAFD", "#A9C2F0", "#5F8FE0", "#0053CE", "#033A8E"];
const heatLabels = ["Vacía", "Poca", "Media", "Alta", "Llena"];

function Heatmap({ heatmap }: { heatmap: Awaited<ReturnType<typeof getDashboard>>["heatmap"] }) {
  return (
    <Card className="flex min-w-0 flex-1 flex-col gap-4 p-5">
      <CardTitle title="Ocupación por franja" aside="Últimas 4 semanas" />
      <div role="table" aria-label="Ocupación por día y franja horaria" className="flex flex-col gap-2">
        <div role="row" className="flex items-center gap-1.5">
          <span className="w-10 shrink-0" />
          {heatmap.bands.map((band) => (
            <span key={band} role="columnheader" className="flex-1 text-center text-caption font-semibold text-ink-muted">
              {band}
            </span>
          ))}
        </div>
        {heatmap.days.map((day, row) => (
          <div key={day} role="row" className="flex items-center gap-1.5">
            <span role="rowheader" className="w-10 shrink-0 text-caption font-semibold text-ink-muted">
              {day}
            </span>
            {heatmap.levels[row]!.map((level, column) => (
              <span
                key={column}
                role="cell"
                title={`${day} ${heatmap.bands[column]}: ${heatLabels[level]}`}
                aria-label={`${day} ${heatmap.bands[column]}: ${heatLabels[level]}`}
                className="h-[54px] flex-1 rounded-[6px]"
                style={{ backgroundColor: heatColors[level] }}
              />
            ))}
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-2">
        <span className="text-caption font-semibold text-ink-muted">Vacía</span>
        {heatColors.map((color) => (
          <span key={color} className="h-2.5 w-[22px] rounded-[3px]" style={{ backgroundColor: color }} />
        ))}
        <span className="text-caption font-semibold text-ink-muted">Llena</span>
        <span className="flex-1" />
        <span className="text-body-sm font-semibold text-elite-blue">{heatmap.insight}</span>
      </div>
    </Card>
  );
}

const attentionStyles: Record<AttentionItem["tone"], { box: string; bar: string; detail: string }> = {
  warning: { box: "bg-warning-soft", bar: "bg-[#D99A00]", detail: "text-warning" },
  info: { box: "bg-blue-tint", bar: "bg-elite-blue", detail: "text-elite-blue" },
  neutral: { box: "bg-surface-muted", bar: "bg-ink-disabled", detail: "text-ink-muted" },
  success: { box: "bg-success-soft", bar: "bg-success", detail: "text-success" },
};

function AttentionRow({ item }: { item: AttentionItem }) {
  const style = attentionStyles[item.tone];
  return (
    <Link href={item.href} className={cn("flex gap-3 rounded-md p-3 transition-[filter] hover:brightness-[0.98]", style.box)}>
      <span className={cn("w-2 shrink-0 rounded-full", style.bar)} />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-label font-bold text-ink">{item.title}</span>
        <span className={cn("text-caption font-medium", style.detail)}>{item.detail}</span>
      </span>
    </Link>
  );
}

function WeeklyRevenue({ weeks }: { weeks: { label: string; value: number; current: boolean }[] }) {
  const max = Math.max(...weeks.map((week) => week.value));
  return (
    <div className="flex flex-col gap-3 border-t border-line pt-4">
      <div className="flex items-baseline justify-between">
        <p className="text-label font-bold text-ink">Ingresos por semana · señas + saldos</p>
        <p className="text-caption font-semibold text-ink-muted">en miles</p>
      </div>
      <div className="flex h-[110px] items-end gap-3.5">
        {weeks.map((week) => (
          <div key={week.label} className="flex flex-1 flex-col items-center gap-1.5">
            <span className={cn("text-micro", week.current ? "font-bold text-elite-blue" : "font-semibold text-ink-muted")}>
              {formatCount(week.value)}
            </span>
            <span
              className={cn("w-full rounded-t-[6px] rounded-b-[2px]", week.current ? "bg-elite-blue" : "bg-sky")}
              style={{ height: Math.round((week.value / max) * 88) }}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-3.5">
        {weeks.map((week) => (
          <span
            key={week.label}
            className={cn("flex-1 text-center text-caption", week.current ? "font-bold text-ink" : "font-semibold text-ink-muted")}
          >
            {week.label}
          </span>
        ))}
      </div>
    </div>
  );
}
