"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

import { useBookingTools } from "@/components/bookings/booking-tools";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/cn";
import { balanceDue, endOf } from "@/lib/data/bookings/presentation";
import type { Booking, Court, CourtBlock } from "@/lib/data/types";
import { hhmm, minutesOf, time } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

// Grid metrics from Paper "Panel / 02 – Agenda".
const HOUR = 72;
const TIME_COLUMN = 64;
const COLUMN = 266;
const INSET = 6;

const px = (minutes: number) => (minutes / 60) * HOUR;

// A court counts as in view when most of its column shows (a vertical scrollbar can clip a few px).
const MOSTLY_VISIBLE = 0.75;

// ── Courts in view: the grid measures them, the page subtitle reads them ──────

type CourtsInView = { first: number; last: number };

const CourtsInViewContext = createContext<{
  view: CourtsInView | null;
  setView: (view: CourtsInView) => void;
} | null>(null);

export function CourtsInViewProvider({ children }: { children: ReactNode }) {
  const [view, setView] = useState<CourtsInView | null>(null);
  return (
    <CourtsInViewContext.Provider
      value={{ view, setView: (next) => setView((prev) => (prev?.first === next.first && prev.last === next.last ? prev : next)) }}
    >
      {children}
    </CourtsInViewContext.Provider>
  );
}

const courtNumber = (court: Court) => court.name.replace(/^Canchas?\s+/i, "");

/** "5", "5 y 6", "4, 5 y 6" */
const joinNumbers = (items: string[]) => (items.length > 1 ? `${items.slice(0, -1).join(", ")} y ${items.at(-1)}` : (items[0] ?? ""));

/**
 * "Jueves 8 de octubre · Canchas 1 a 4 de 6 · deslizá para ver 5 y 6" while some courts are off
 * screen; "Jueves 8 de octubre · 6 canchas" when all of them fit.
 */
export function AgendaSubtitle({ date, courts }: { date: string; courts: Court[] }) {
  const view = useContext(CourtsInViewContext)?.view;
  if (!view || (view.first === 0 && view.last >= courts.length - 1)) return `${date} · ${courts.length} canchas`;
  const shown =
    view.first === view.last
      ? `Cancha ${courtNumber(courts[view.first]!)} de ${courts.length}`
      : `Canchas ${courtNumber(courts[view.first]!)} a ${courtNumber(courts[view.last]!)} de ${courts.length}`;
  const hidden = courts.filter((_, index) => index < view.first || index > view.last).map(courtNumber);
  return `${date} · ${shown} · deslizá para ver ${joinNumbers(hidden)}`;
}

type Props = {
  day: string;
  courts: Court[];
  bookings: Booking[];
  blocks: CourtBlock[];
  openFrom: string;
  openTo: string;
  /** Current time when `day` is today; draws the red line. */
  nowTime: string | null;
};

export function AgendaGrid({ day, courts, bookings, blocks, openFrom, openTo, nowTime }: Props) {
  const { openNew, openDetail } = useBookingTools();
  const scroller = useRef<HTMLDivElement>(null);
  const start = minutesOf(openFrom);
  const end = minutesOf(openTo);
  const hours = Array.from({ length: (end - start) / 60 }, (_, i) => start + i * 60);
  const height = px(end - start);
  const offset = (iso: string) => px(minutesOf(time(iso)) - start);

  // Start scrolled to an hour before now (or 15:00), like the design.
  useEffect(() => {
    const target = nowTime ? minutesOf(nowTime) - 180 : minutesOf("15:00");
    scroller.current?.scrollTo({ top: Math.max(px(target - start), 0) });
  }, [day, nowTime, start]);

  // Which court columns are in view, for the subtitle. Re-measured on resize and horizontal scroll.
  const setView = useContext(CourtsInViewContext)?.setView;
  useEffect(() => {
    const el = scroller.current;
    if (!el || !setView || courts.length === 0) return;
    const measure = () => {
      // The sticky hours column covers the first TIME_COLUMN px of the viewport.
      const from = el.scrollLeft + TIME_COLUMN;
      const to = el.scrollLeft + el.clientWidth;
      const shown = courts.map((_, index) => {
        const left = TIME_COLUMN + index * COLUMN;
        return Math.max(0, Math.min(to, left + COLUMN) - Math.max(from, left)) / COLUMN;
      });
      const inView = shown.flatMap((ratio, index) => (ratio >= MOSTLY_VISIBLE ? [index] : []));
      const best = shown.indexOf(Math.max(...shown));
      setView({ first: inView[0] ?? best, last: inView.at(-1) ?? best });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    el.addEventListener("scroll", measure, { passive: true });
    return () => {
      observer.disconnect();
      el.removeEventListener("scroll", measure);
    };
  }, [courts, setView]);

  return (
    <div className="flex min-h-[420px] flex-1 flex-col overflow-hidden rounded-card border border-line bg-white">
      <div ref={scroller} className="relative min-h-0 flex-1 overflow-auto">
        <div style={{ width: TIME_COLUMN + COLUMN * courts.length }}>
          {/* Court headers */}
          <div className="sticky top-0 z-20 flex h-11 border-b border-line bg-white">
            <div className="sticky left-0 z-10 shrink-0 bg-white" style={{ width: TIME_COLUMN }} />
            {courts.map((court) => (
              <div
                key={court.id}
                className="flex shrink-0 items-center gap-2 border-l border-line px-3.5"
                style={{ width: COLUMN }}
              >
                <span className="font-display text-body leading-5 text-ink">{court.name}</span>
                <span className="text-caption font-medium text-ink-muted">{court.type === "techada" ? "Techada" : "Descubierta"}</span>
              </div>
            ))}
          </div>

          <div className="relative flex" style={{ height }}>
            {/* Hours */}
            <div className="sticky left-0 z-10 shrink-0 bg-white" style={{ width: TIME_COLUMN }}>
              {hours.map((hour) => (
                <div key={hour} className="border-b border-line px-2.5 py-1.5 text-caption font-semibold text-ink-muted" style={{ height: HOUR }}>
                  {hhmm(hour)}
                </div>
              ))}
            </div>

            {courts.map((court) => (
              <div key={court.id} className="relative shrink-0 border-l border-line" style={{ width: COLUMN }}>
                {hours.map((hour) => (
                  <button
                    key={hour}
                    type="button"
                    aria-label={`Reservar ${court.name} a las ${hhmm(hour)}`}
                    onClick={() => openNew({ day, time: hhmm(hour), courtId: court.id })}
                    className="group block w-full border-b border-line p-1.5 focus-visible:outline-none"
                    style={{ height: HOUR }}
                  >
                    <span className="flex h-full items-center justify-center gap-1.5 rounded-control border-[1.5px] border-dashed border-sky text-body-sm font-semibold text-ink-muted opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
                      <Icon name="plus" size={16} />
                      Reservar {hhmm(hour)}
                    </span>
                  </button>
                ))}

                {blocks
                  .filter((block) => block.courtIds.includes(court.id))
                  .map((block) => (
                    <BlockCard
                      key={block.id}
                      block={block}
                      top={offset(block.start) + INSET / 2}
                      height={px(minutesOf(time(block.end)) - minutesOf(time(block.start))) - INSET}
                    />
                  ))}

                {bookings
                  .filter((booking) => booking.courtId === court.id)
                  .map((booking) => (
                    <BookingCard
                      key={booking.id}
                      booking={booking}
                      top={offset(booking.start) + INSET / 2}
                      height={px(booking.durationMin) - INSET}
                      onOpen={() => openDetail(booking)}
                    />
                  ))}
              </div>
            ))}

            {nowTime && minutesOf(nowTime) >= start && minutesOf(nowTime) <= end && (
              <div
                aria-hidden
                className="pointer-events-none absolute z-10 h-0.5 bg-danger"
                style={{ top: px(minutesOf(nowTime) - start), left: TIME_COLUMN - 8, right: 0 }}
              >
                <span className="absolute -left-1 -top-1 size-2.5 rounded-full bg-danger" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function cardPosition(top: number, height: number) {
  return { top, height, left: INSET, right: INSET };
}

function BookingCard({ booking, top, height, onOpen }: { booking: Booking; top: number; height: number; onOpen: () => void }) {
  const range = `${time(booking.start)} – ${time(endOf(booking))}`;
  const pending = booking.depositStatus === "pendiente";
  const match = booking.match && !booking.match.closed ? booking.match : null;

  let title = booking.organizer.name;
  let detail: string;
  let detailClass = "text-success";
  if (match) {
    const missing = match.needed - match.players.length;
    title = `Partido abierto · ${match.level.replace("–", " – ")}`;
    detail = `${missing > 0 ? `Falta${missing > 1 ? "n" : ""} ${missing} ${missing > 1 ? "jugadores" : "jugador"}` : "Completo"}${booking.depositStatus === "pagada" ? " · seña pagada" : ""}`;
    detailClass = "text-ink-muted";
  } else if (pending) {
    detail = `Seña pendiente${booking.depositExpiresAt ? ` · vence ${time(booking.depositExpiresAt)}` : ""}`;
    detailClass = "text-warning";
  } else if (booking.balancePaid) {
    detail = "Saldo cobrado";
  } else if (booking.origin === "turno-fijo") {
    detail = "Turno fijo · paga en el club";
  } else if (booking.depositStatus === "pagada") {
    detail = `Seña pagada · saldo ${formatMoney(balanceDue(booking) ?? 0)}`;
  } else {
    detail = booking.origin === "recepcion" ? "Carga manual · paga en el club" : "Paga en el club";
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      style={cardPosition(top, height)}
      className={cn(
        "absolute z-[1] flex flex-col gap-0.5 overflow-hidden rounded-control px-3 py-2.5 text-left transition-shadow hover:shadow-menu",
        match
          ? "border-[1.5px] border-dashed border-elite-blue bg-white"
          : pending
            ? "border-l-4 border-[#D99A00] bg-warning-soft"
            : "border-l-4 border-elite-blue bg-blue-tint",
      )}
    >
      <span className={cn("text-caption font-semibold", pending ? "text-warning" : "text-elite-blue")}>
        {range}
        {booking.origin === "turno-fijo" && " · Turno fijo"}
      </span>
      <span className="truncate text-label font-bold text-ink">{title}</span>
      {height > 70 && (
        <span className={cn("flex items-center gap-1.5 truncate text-caption font-semibold", detailClass)}>
          {match && <span className="size-2 shrink-0 rounded-full border border-success bg-energy-lime" />}
          {detail}
        </span>
      )}
    </button>
  );
}

function BlockCard({ block, top, height }: { block: CourtBlock; top: number; height: number }) {
  const range = `${time(block.start)} – ${time(block.end)}`;
  const event = block.reason === "evento";
  return (
    <div
      style={cardPosition(top, height)}
      className={cn(
        "absolute z-[1] flex flex-col gap-0.5 overflow-hidden rounded-control px-3 py-2.5",
        event ? "bg-deep-blue" : "border border-line bg-surface-muted",
      )}
    >
      <span className={cn("flex items-center gap-1.5 text-caption font-semibold", event ? "text-sky" : "text-ink-muted")}>
        {!event && <Icon name="lock" size={14} />}
        {range}
      </span>
      <span className={cn("truncate text-label font-bold", event ? "text-white" : "text-ink-muted")}>
        {event ? `Bloqueo · ${block.title.replace(/^Bloqueo · /, "")}` : block.title}
      </span>
      {block.note && height > 70 && (
        <span className={cn("truncate text-caption font-semibold", event ? "text-sky" : "text-ink-muted")}>{block.note}</span>
      )}
    </div>
  );
}
