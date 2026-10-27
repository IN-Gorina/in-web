import "server-only";

import { dayKey, now, time, weekdayLabels } from "@/lib/dates";

import { mockResponse } from "../backend";
import { db } from "../mock/store";

/** 0 = empty … 4 = full, per weekday (Lun…Dom) and two-hour band (8–10 … 22–24). */
const occupancy: number[][] = [
  [0, 0, 1, 0, 2, 4, 4, 2],
  [0, 0, 1, 0, 2, 4, 4, 3],
  [0, 1, 1, 0, 3, 4, 4, 2],
  [0, 0, 1, 1, 2, 4, 4, 3],
  [1, 1, 1, 1, 3, 4, 3, 1],
  [3, 4, 3, 2, 2, 3, 2, 1],
  [3, 4, 2, 1, 1, 2, 1, 0],
];

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

export async function getDashboard(): Promise<DashboardStats> {
  const store = db();
  const today = dayKey(now());

  const pendingDeposits = store.bookings.filter(
    (booking) => !booking.cancelled && booking.depositStatus === "pendiente" && dayKey(booking.start) >= today,
  ).length;
  const requests = store.fixedSlots.filter((slot) => slot.status === "pedido");
  const openReports = store.reports.filter((report) => report.status === "abierta").length;
  const maintenance = store.courts.filter((court) => court.maintenance && dayKey(court.maintenance.until) === today);

  const attention: AttentionItem[] = [];
  if (pendingDeposits > 0)
    attention.push({
      tone: "warning",
      title: `${pendingDeposits} ${pendingDeposits === 1 ? "seña" : "señas"} por vencer`,
      detail: `Si no se pagan en ${store.rules.depositMinutes} min, el turno se libera solo`,
      href: "/reservas?estado=sena-pendiente",
    });
  if (requests.length > 0)
    attention.push({
      tone: "info",
      title: `${requests.length} ${requests.length === 1 ? "pedido" : "pedidos"} de turno fijo`,
      detail: requests
        .map((slot) => `${slot.holder.name.split(" ")[0]} · ${weekdayLabels[slot.weekday].short} ${slot.time}`)
        .join(" · "),
      href: "/turnos-y-partidos",
    });
  for (const court of maintenance)
    attention.push({
      tone: "neutral",
      title: `${court.name} bloqueada hasta las ${time(court.maintenance!.until).replace(":00", "")}`,
      detail: "Mantenimiento · avisar si se extiende",
      href: "/canchas-y-tarifas",
    });
  if (openReports > 0)
    attention.push({
      tone: "success",
      title: `${openReports} ${openReports === 1 ? "publicación denunciada" : "publicaciones denunciadas"}`,
      detail: "Revisalas en Moderación",
      href: "/moderacion",
    });

  return mockResponse({
    month: "octubre",
    revenue: { value: 4_820_000, delta: "+12% vs septiembre" },
    occupancy: { value: 71, delta: "+6 pts vs septiembre" },
    members: { value: 1284, detail: "+86 este mes · 142 pre-inscriptos" },
    cancellations: { value: 23, detail: "4% del mes · 9 vencieron sin seña" },
    heatmap: {
      bands: ["8–10", "10–12", "12–14", "14–16", "16–18", "18–20", "20–22", "22–24"],
      days: ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"],
      levels: occupancy,
      insight: "Mediodías de semana: 22% → ideal para partidos abiertos",
    },
    weeklyRevenue: [
      { label: "Sem 1", value: 1040, current: false },
      { label: "Sem 2", value: 1120, current: false },
      { label: "Sem 3", value: 1210, current: false },
      { label: "Esta", value: 1450, current: true },
    ],
    attention,
  });
}
