"use client";

import { useState, useTransition } from "react";

import { useBookingTools } from "@/components/bookings/booking-tools";
import { Card, CardTitle } from "@/components/ui/card";
import { Callout } from "@/components/ui/callout";
import { Segmented } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { closeMatch, notifyCompatiblePlayers } from "@/lib/data/fixed-slots/actions";
import type { Booking } from "@/lib/data/types";
import { relativeDateTime } from "@/lib/dates";
import { initials } from "@/lib/format";

type Tab = "abiertos" | "completos" | "cerrados";
// Social › Partidos in the members' app, when its web URL is configured. There's no portal page in the panel.
const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
const portalMatchesUrl = appUrl ? `${appUrl}/social?categoria=partidos` : null;

const avatarTones = ["bg-deep-blue text-white", "bg-elite-blue text-white", "bg-blue-tint text-elite-blue"];

export function MatchesCard({ matches }: { matches: Booking[] }) {
  const [tab, setTab] = useState<Tab>("abiertos");
  const [closing, setClosing] = useState<Booking | null>(null);
  const open = matches.filter((b) => !b.match!.closed && b.match!.players.length < b.match!.needed);
  const complete = matches.filter((b) => !b.match!.closed && b.match!.players.length >= b.match!.needed);
  const closed = matches.filter((b) => b.match!.closed);
  const list = tab === "abiertos" ? open : tab === "completos" ? complete : closed;

  return (
    <Card className="flex min-w-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-5 pb-4 pt-[18px]">
        <CardTitle title="Partidos abiertos" />
        <Segmented
          label="Estado de los partidos"
          value={tab}
          onChange={setTab}
          options={[
            { value: "abiertos", label: "Abiertos", count: open.length },
            { value: "completos", label: "Completos", count: complete.length },
            { value: "cerrados", label: "Cerrados", count: closed.length },
          ]}
        />
      </div>
      <div className="flex h-10 items-center gap-3.5 border-y border-line bg-surface-muted px-5 text-caption font-bold uppercase tracking-label text-ink-muted">
        <span className="flex-1">Partido · organiza</span>
        <span className="w-16">Nivel</span>
        <span className="w-[196px]">Jugadores</span>
        <span className="w-[214px]" />
      </div>

      <div className="flex flex-1 flex-col">
        {list.length === 0 ? (
          <EmptyState
            icon="users"
            title={tab === "abiertos" ? "No hay partidos buscando jugadores" : tab === "completos" ? "No hay partidos completos" : "No hay partidos cerrados"}
            description="Los partidos que los socios abren desde la app aparecen acá."
          />
        ) : (
          list.map((booking) => <MatchRow key={booking.id} booking={booking} onClose={() => setClosing(booking)} />)
        )}
      </div>

      <div className="m-5 mt-auto">
        <Callout tone="neutral">
          <span className="flex items-center gap-2.5">
            <span className="flex-1">
              Los partidos abiertos también se publican en Social › Partidos de la app. La reserva y la seña son siempre de quien organiza.
            </span>
            {portalMatchesUrl && (
              <a href={portalMatchesUrl} target="_blank" rel="noopener noreferrer" className="shrink-0 font-bold text-link hover:underline">
                Ver en el portal
              </a>
            )}
          </span>
        </Callout>
      </div>

      {closing && <CloseMatchDialog booking={closing} onClose={() => setClosing(null)} />}
    </Card>
  );
}

function MatchRow({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { courtById, openDetail } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const match = booking.match!;
  const missing = Math.max(match.needed - match.players.length, 0);

  const notify = () =>
    startTransition(async () => {
      const result = await notifyCompatiblePlayers(booking.id);
      toast(result.ok ? `Avisamos a ${result.data.count} socios de ${match.level}` : result.error, result.ok ? "success" : "error");
    });

  return (
    <div className="flex h-[68px] shrink-0 items-center gap-3.5 border-b border-line px-5">
      <button type="button" onClick={() => openDetail(booking)} className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="text-label font-bold text-ink">{relativeDateTime(booking.start)}</span>
        <span className="truncate text-caption font-medium text-ink-muted">
          {courtById(booking.courtId)?.name} · {booking.organizer.name}
        </span>
      </button>
      <span className="w-16 shrink-0">
        <span className="inline-flex h-6 items-center rounded-full border border-line bg-surface-muted px-[9px] text-caption font-bold text-ink">
          {match.level}
        </span>
      </span>
      <span className="flex w-[196px] shrink-0 items-center gap-2">
        <span className="relative h-[30px] shrink-0" style={{ width: 30 + (match.needed - 1) * 26 }}>
          {Array.from({ length: match.needed }, (_, index) => {
            const player = match.players[index];
            return (
              <span
                key={index}
                title={player}
                className={cn(
                  "absolute top-0 flex size-[30px] items-center justify-center rounded-full text-micro font-bold",
                  player ? cn("border-2 border-white", avatarTones[index % avatarTones.length]) : "border-[1.5px] border-dashed border-elite-blue bg-white text-elite-blue",
                )}
                style={{ left: index * 26 }}
              >
                {player ? initials(player) : <Icon name="plus" size={12} strokeWidth={2.5} />}
              </span>
            );
          })}
        </span>
        {missing > 0 && (
          <span className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-elite-blue bg-white px-[9px] text-caption font-bold text-elite-blue">
            <span className="size-[7px] rounded-full border border-deep-blue bg-energy-lime" />
            {missing === 1 ? "Falta 1" : `Faltan ${missing}`}
          </span>
        )}
      </span>
      <span className="flex w-[214px] shrink-0 items-center justify-end gap-1.5">
        {!match.closed && missing > 0 && (
          <button
            type="button"
            onClick={notify}
            disabled={pending}
            className="inline-flex h-[34px] items-center gap-1.5 whitespace-nowrap rounded-[9px] bg-blue-tint px-3 text-caption font-bold text-elite-blue hover:brightness-95 disabled:opacity-60"
          >
            <Icon name="bell" size={16} />
            Avisar a compatibles
          </button>
        )}
        {!match.closed && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar partido"
            title="Cerrar partido"
            className="flex size-[34px] items-center justify-center rounded-[9px] border border-line bg-white text-ink-muted hover:bg-field"
          >
            <Icon name="x" size={16} />
          </button>
        )}
      </span>
    </div>
  );
}

function CloseMatchDialog({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      pending={pending}
      icon="users"
      tone="primary"
      title="¿Cerrar el partido?"
      description={`Deja de publicarse en Social › Partidos. La reserva de ${booking.organizer.name} sigue en pie.`}
      confirmLabel="Cerrar partido"
      onConfirm={() =>
        startTransition(async () => {
          const result = await closeMatch(booking.id);
          toast(result.ok ? "Partido cerrado" : result.error, result.ok ? "success" : "error");
          if (result.ok) onClose();
        })
      }
    />
  );
}
