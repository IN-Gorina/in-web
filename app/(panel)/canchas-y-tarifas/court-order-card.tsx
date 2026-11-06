"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle } from "@/components/ui/card";
import { Segmented, Switch } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { previewCourtUnavailable, resetCourtOrder, saveCourtOrder, setCourtUnavailable } from "@/lib/data/club/actions";
import type { CourtOrder } from "@/lib/data/club/service";
import { longDate } from "@/lib/dates";

/**
 * Order the members' app shows the free courts in (Canchas y tarifas): the default one, or one for a
 * day that overrides it; for a day, a court can also be unavailable. The day lives in ?orden=.
 */
export function CourtOrderCard({ order, today }: { order: CourtOrder; today: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [ids, setIds] = useState(order.courts.map((c) => c.id));
  const [confirming, setConfirming] = useState<{ courtId: string; name: string; bookings: { name: string; time: string }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const byId = new Map(order.courts.map((c) => [c.id, c]));
  const dirty = ids.join() !== order.courts.map((c) => c.id).join();
  const day = order.date;

  const go = (date: string | null) => {
    setError(null);
    router.push(date ? `${pathname}?orden=${date}` : pathname);
  };

  const move = (index: number, delta: -1 | 1) =>
    setIds((current) => {
      const next = [...current];
      const [id] = next.splice(index, 1);
      next.splice(index + delta, 0, id!);
      return next;
    });

  const run = (fn: () => Promise<{ ok: true } | { ok: false; error: string }>, message: string) =>
    startTransition(async () => {
      setError(null);
      const result = await fn();
      if (!result.ok) return setError(result.error);
      toast(message);
    });

  const toggleUnavailable = (courtId: string, unavailable: boolean) =>
    startTransition(async () => {
      if (!day) return;
      setError(null);
      if (unavailable) {
        const preview = await previewCourtUnavailable({ date: day, courtId });
        if (!preview.ok) return setError(preview.error);
        if (preview.data.length > 0) return setConfirming({ courtId, name: byId.get(courtId)!.name, bookings: preview.data });
      }
      const result = await setCourtUnavailable({ date: day, courtId, unavailable });
      if (!result.ok) return setError(result.error);
      toast(unavailable ? `${byId.get(courtId)!.name} no disponible ese día` : `${byId.get(courtId)!.name} disponible otra vez`);
    });

  return (
    <Card className="flex flex-col gap-4 p-6">
      <div className="flex flex-col gap-1">
        <CardTitle title="Orden en la app" />
        <p className="text-body-sm font-medium text-ink-muted">
          Así ven los socios las canchas libres al reservar: la primera viene elegida. Sirve para llenar primero algunas canchas.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Qué orden editar"
          value={day ? "dia" : "defecto"}
          onChange={(value) => go(value === "dia" ? today : null)}
          options={[
            { value: "defecto", label: "Por defecto" },
            { value: "dia", label: "Un día" },
          ]}
        />
        {day && (
          <TextInput
            type="date"
            aria-label="Día"
            value={day}
            min={today}
            onChange={(e) => e.target.value && go(e.target.value)}
            className="w-[180px]"
          />
        )}
      </div>

      {day && (
        <p className="text-body-sm font-semibold text-ink">
          {longDate(`${day}T12:00:00-03:00`)} · {order.ownOrder ? "orden propio de ese día" : "usa el orden por defecto"}
        </p>
      )}

      <ol className="flex flex-col">
        {ids.map((id, index) => {
          const court = byId.get(id)!;
          return (
            <li key={id} className="flex h-[52px] items-center gap-3 border-b border-line last:border-b-0">
              <span className="w-6 text-center font-display text-title-card text-ink">{index + 1}</span>
              <span className={cn("flex-1 text-label font-bold", court.unavailable ? "text-ink-muted line-through" : "text-ink")}>{court.name}</span>
              {day && (
                <Switch
                  label={`${court.name} no disponible todo el día`}
                  checked={court.unavailable}
                  disabled={pending}
                  onChange={(checked) => toggleUnavailable(id, checked)}
                />
              )}
              {day && <span className="w-[92px] text-caption font-medium text-ink-muted">{court.unavailable ? "No disponible" : "Disponible"}</span>}
              <span className="flex gap-1">
                <button type="button" aria-label={`Subir ${court.name}`} disabled={index === 0} onClick={() => move(index, -1)} className="rounded-md p-1.5 text-ink-muted hover:bg-field disabled:opacity-30">
                  <Icon name="chevron-up" size={16} />
                </button>
                <button type="button" aria-label={`Bajar ${court.name}`} disabled={index === ids.length - 1} onClick={() => move(index, 1)} className="rounded-md p-1.5 text-ink-muted hover:bg-field disabled:opacity-30">
                  <Icon name="chevron-down" size={16} />
                </button>
              </span>
            </li>
          );
        })}
      </ol>

      {error && <Callout tone="danger">{error}</Callout>}

      <div className="flex items-center gap-3">
        <Button icon="check" disabled={!dirty || pending} onClick={() => run(() => saveCourtOrder({ date: day, courtIds: ids }), day ? "Orden del día guardado · ya se ve en la app" : "Orden por defecto guardado · ya se ve en la app")}>
          Guardar orden
        </Button>
        {day && order.ownOrder && (
          <Button variant="ghost" disabled={pending} onClick={() => run(() => resetCourtOrder(day), "Ese día vuelve al orden por defecto")}>
            Usar el orden por defecto
          </Button>
        )}
      </div>

      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={`¿${confirming?.name} no disponible ese día?`}
        description={`Se cancelan ${confirming?.bookings.length} ${confirming?.bookings.length === 1 ? "reserva" : "reservas"} con devolución de la seña, y les avisamos a los socios: ${confirming?.bookings.map((b) => `${b.name} (${b.time})`).join(", ")}.`}
        confirmLabel="Marcar no disponible"
        pending={pending}
        onConfirm={() => {
          const target = confirming;
          setConfirming(null);
          if (!target || !day) return;
          run(() => setCourtUnavailable({ date: day, courtId: target.courtId, unavailable: true }), `${target.name} no disponible ese día`);
        }}
      />
    </Card>
  );
}
