import type { Weekday } from "./data/types";

/** Club time zone. Every date in the panel is shown in Argentina time. */
export const TIME_ZONE = "America/Argentina/Buenos_Aires";

/** "Now" for the panel. */
export function now(): Date {
  return new Date();
}

/** ISO string in club time ("2026-10-08T18:10:00-03:00"), so stored dates sort correctly as text. */
export function toLocalIso(date: Date): string {
  return `${dayKey(date)}T${time(date)}:${String(date.getUTCSeconds()).padStart(2, "0")}-03:00`;
}

/** now() as a club-time ISO string. */
export function nowIso(): string {
  return toLocalIso(now());
}

const partsFormatter = new Intl.DateTimeFormat("es-AR", {
  timeZone: TIME_ZONE,
  weekday: "short",
  day: "numeric",
  month: "short",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const longWeekday = new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, weekday: "long" });
const longMonth = new Intl.DateTimeFormat("es-AR", { timeZone: TIME_ZONE, month: "long" });

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);
const clean = (text: string) => text.replace(".", "");

function parts(date: Date | string) {
  const value = typeof date === "string" ? new Date(date) : date;
  const map = Object.fromEntries(partsFormatter.formatToParts(value).map((part) => [part.type, part.value]));
  return {
    weekday: capitalize(clean(map.weekday!)), // "Jue"
    day: Number(map.day),
    month: clean(map.month!), // "oct"
    year: Number(map.year),
    time: `${map.hour}:${map.minute}`, // "16:30"
  };
}

/** "YYYY-MM-DD" of a date in club time. */
export function dayKey(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(value);
}

/** Builds an ISO date in club time from "YYYY-MM-DD" and "HH:mm". */
export function toIso(day: string, time: string): string {
  return `${day}T${time}:00-03:00`;
}

export function addDays(day: string, amount: number): string {
  const date = new Date(`${day}T12:00:00-03:00`);
  date.setUTCDate(date.getUTCDate() + amount);
  return dayKey(date);
}

export function addMinutes(iso: string, minutes: number): string {
  const date = new Date(iso);
  return new Date(date.getTime() + minutes * 60_000).toISOString();
}

export function time(date: Date | string): string {
  return parts(date).time;
}

/** "Jue 8 · 16:30" */
export function shortDateTime(date: Date | string): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} · ${p.time}`;
}

/** "Jue 8" */
export function shortDay(date: Date | string): string {
  const p = parts(date);
  return `${p.weekday} ${p.day}`;
}

/** "Jue 8 oct" */
export function shortDate(date: Date | string): string {
  const p = parts(date);
  return `${p.weekday} ${p.day} ${p.month}`;
}

/** "8 oct" */
export function dayMonth(date: Date | string): string {
  const p = parts(date);
  return `${p.day} ${p.month}`;
}

/** "Jueves 8 de octubre" */
export function longDate(date: Date | string): string {
  const value = typeof date === "string" ? new Date(date) : date;
  return `${capitalize(longWeekday.format(value))} ${parts(value).day} de ${longMonth.format(value)}`;
}

/** "mar 2025" */
export function monthYear(date: Date | string): string {
  const p = parts(typeof date === "string" && date.length === 10 ? `${date}T12:00:00-03:00` : date);
  return `${p.month} ${p.year}`;
}

/** "octubre" */
export function monthName(date: Date | string): string {
  return longMonth.format(typeof date === "string" ? new Date(date) : date);
}

/** "Hoy", "Ayer", "Mié 7" relative to now(). */
export function relativeDay(date: Date | string): string {
  const key = dayKey(date);
  const today = dayKey(now());
  if (key === today) return "Hoy";
  if (key === addDays(today, -1)) return "Ayer";
  if (key === addDays(today, 1)) return "Mañana";
  return shortDay(date);
}

/** "Hoy · 18:00", "Vie 9 · 09:00" */
export function relativeDateTime(date: Date | string): string {
  return `${relativeDay(date)} · ${time(date)}`;
}

/** "Hoy", "Ayer", "Hace 3 días", "Hace 2 meses" */
export function ago(date: Date | string): string {
  const days = Math.round((new Date(dayKey(now())).getTime() - new Date(dayKey(date)).getTime()) / 86_400_000);
  if (days <= 0) return "Hoy";
  if (days === 1) return "Ayer";
  if (days < 30) return `Hace ${days} días`;
  const months = Math.round(days / 30);
  return months === 1 ? "Hace 1 mes" : `Hace ${months} meses`;
}

/** "hace 3 h", "hace 20 min" (for recent activity). */
export function hoursAgo(date: Date | string): string {
  const minutes = Math.round((now().getTime() - new Date(date).getTime()) / 60_000);
  if (minutes < 60) return `hace ${Math.max(minutes, 1)} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  return ago(date).toLowerCase();
}

export const weekdayLabels: Record<Weekday, { short: string; long: string; plural: string }> = {
  lun: { short: "Lun", long: "Lunes", plural: "lunes" },
  mar: { short: "Mar", long: "Martes", plural: "martes" },
  mie: { short: "Mié", long: "Miércoles", plural: "miércoles" },
  jue: { short: "Jue", long: "Jueves", plural: "jueves" },
  vie: { short: "Vie", long: "Viernes", plural: "viernes" },
  sab: { short: "Sáb", long: "Sábado", plural: "sábados" },
  dom: { short: "Dom", long: "Domingo", plural: "domingos" },
};

const weekdayOrder: Weekday[] = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"];

export function weekdayOf(date: Date | string): Weekday {
  const value = typeof date === "string" ? new Date(date) : date;
  const index = new Date(`${dayKey(value)}T12:00:00-03:00`).getUTCDay();
  return weekdayOrder[index]!;
}

/** Minutes since 00:00 for "HH:mm". */
export function minutesOf(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h! * 60 + m!;
}

export function hhmm(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
