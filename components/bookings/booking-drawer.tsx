"use client";

import Link from "next/link";
import { useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/card";
import { Drawer, DrawerClose } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { resendDepositLink } from "@/lib/data/bookings/actions";
import { balanceDue, bandLabel, bookingStatus, endOf } from "@/lib/data/bookings/presentation";
import type { Booking } from "@/lib/data/types";
import { hoursAgo, relativeDateTime, shortDate, time } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { useBookingTools } from "./booking-tools";

/** Paper "Panel / 03b – Detalle de reserva". */
export function BookingDrawer({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  return (
    <Drawer open={booking !== null} onClose={onClose} label="Detalle de reserva">
      {booking && <Detail booking={booking} onClose={onClose} />}
    </Drawer>
  );
}

function Detail({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { data, courtById, openCancel, openPayment, openMove } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const court = courtById(booking.courtId);
  const status = bookingStatus(booking);
  const member = data.members.find((m) => m.id === booking.organizer.memberId);
  const active = !booking.cancelled;
  const depositPending = active && booking.depositStatus === "pendiente";
  // While the deposit is pending, show what the balance will be once it's paid.
  const due = depositPending ? booking.price - booking.deposit : balanceDue(booking);

  const statusText =
    booking.depositStatus === "pendiente" && booking.depositExpiresAt && active
      ? `${status.label} · vence ${time(booking.depositExpiresAt)}`
      : status.label;

  const resend = () =>
    startTransition(async () => {
      const result = await resendDepositLink(booking.id);
      toast(result.ok ? "Le reenviamos el link de seña" : result.error, result.ok ? "success" : "error");
    });

  return (
    <>
      <header className="flex items-start justify-between gap-4 border-b border-line px-7 pb-5 pt-7">
        <div className="flex min-w-0 flex-col gap-2.5">
          <Badge tone={status.tone} className="self-start">
            {statusText}
          </Badge>
          <h2 className="font-display text-headline text-ink">
            {court?.name} · {shortDate(booking.start)}
          </h2>
          <p className="text-label font-semibold text-ink-muted">
            {time(booking.start)} – {time(endOf(booking))} · {booking.durationMin} min · {court?.type === "techada" ? "Techada" : "Descubierta"}
          </p>
        </div>
        <DrawerClose onClose={onClose} />
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-7 py-6">
        <section className="flex flex-col gap-2.5">
          <Eyebrow>Organiza</Eyebrow>
          <div className="flex items-center gap-3">
            <Avatar name={booking.organizer.name} tone="tint" size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="truncate text-body font-bold text-ink">{booking.organizer.name}</p>
              <p className="truncate text-caption font-medium text-ink-muted">
                {booking.organizer.guest
                  ? "Invitado sin app"
                  : [member?.category, member?.phone ?? member?.email].filter(Boolean).join(" · ") || "Socio"}
              </p>
            </div>
            {booking.organizer.memberId && (
              <Link href={`/socios/${booking.organizer.memberId}`} className="text-body-sm font-bold text-link hover:underline">
                Ver socio
              </Link>
            )}
          </div>
          {booking.match && (
            <p className="text-body-sm font-medium text-ink-muted">
              Partido abierto {booking.match.level} · {booking.match.players.length}/{booking.match.needed} jugadores:{" "}
              {booking.match.players.join(", ")}
            </p>
          )}
        </section>

        <section className="flex flex-col gap-2.5">
          <Eyebrow>Cobro</Eyebrow>
          <div className="flex flex-col rounded-md bg-surface-muted px-4 py-1">
            <Line label={`Turno · ${bandLabel(time(booking.start)).toLowerCase()} ${booking.durationMin} min`} value={formatMoney(booking.price)} />
            {booking.deposit > 0 && (
              <Line
                label={`Seña · ${booking.origin === "app" ? "Mercado Pago" : "en el club"}`}
                value={`${formatMoney(booking.deposit)} ${depositWord[booking.depositStatus]}`}
                tone={booking.depositStatus === "pendiente" ? "warning" : booking.depositStatus === "devuelta" ? "danger" : "default"}
              />
            )}
            <div className="flex h-11 items-center justify-between border-t border-line">
              <span className="text-label font-bold text-ink">{booking.balancePaid ? "Saldo cobrado" : "Saldo a cobrar en el club"}</span>
              <span className="font-display text-title-card text-ink">{due === null ? "—" : formatMoney(due)}</span>
            </div>
          </div>
        </section>

        <section className="flex flex-col gap-3">
          <Eyebrow>Historial</Eyebrow>
          {booking.depositStatus === "pendiente" && active && booking.depositExpiresAt && (
            <TimelineItem
              tone="warning"
              title="Esperando la seña por Mercado Pago"
              detail={`Si no se paga a las ${time(booking.depositExpiresAt)}, el turno se libera solo`}
            />
          )}
          {booking.history.map((entry, index) => (
            <TimelineItem
              key={index}
              tone="muted"
              title={entry.text}
              detail={[relativeDateTime(entry.at), entry.by].filter(Boolean).join(" · ")}
              hint={hoursAgo(entry.at)}
            />
          ))}
        </section>
      </div>

      {active && (
        <footer className="flex flex-col gap-2.5 border-t border-line px-7 pb-7 pt-5">
          {(depositPending || (due !== null && due > 0)) && (
            <Button size="lg" icon="cash" fullWidth onClick={() => openPayment(booking)} className="h-12 text-body">
              Registrar cobro
            </Button>
          )}
          {booking.depositStatus === "pendiente" && (
            <Button size="lg" variant="secondary" icon="send" fullWidth onClick={resend} disabled={pending}>
              Reenviar link de seña
            </Button>
          )}
          <div className="flex gap-2.5">
            <Button variant="secondary" size="lg" className="flex-1" onClick={() => openMove(booking)}>
              Mover de horario
            </Button>
            <Button variant="danger-outline" size="lg" className="flex-1" onClick={() => openCancel(booking)}>
              Cancelar reserva
            </Button>
          </div>
        </footer>
      )}
    </>
  );
}

const depositWord: Record<Booking["depositStatus"], string> = {
  "no-aplica": "",
  pendiente: "pendiente",
  pagada: "pagada",
  devuelta: "devuelta",
  retenida: "retenida",
};

function Line({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "warning" | "danger" }) {
  return (
    <div className="flex h-10 items-center justify-between border-t border-line first:border-t-0">
      <span className="text-label font-medium text-ink-muted">{label}</span>
      <span
        className={cn(
          "text-label font-bold",
          tone === "default" && "text-ink",
          tone === "warning" && "text-warning",
          tone === "danger" && "text-danger",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TimelineItem({ tone, title, detail, hint }: { tone: "warning" | "muted"; title: string; detail: string; hint?: string }) {
  return (
    <div className="flex gap-3">
      <span className="flex w-2.5 shrink-0 justify-center pt-1.5">
        <span className={cn("size-2 rounded-full", tone === "warning" ? "bg-warning-dot" : "bg-sky")} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <p className="text-body-sm font-semibold text-ink">{title}</p>
        <p className="text-caption font-medium text-ink-muted" title={hint}>
          {detail}
        </p>
      </div>
    </div>
  );
}
