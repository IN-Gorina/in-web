"use client";

import { useEffect, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ChipGroup, SwitchRow, TileGroup } from "@/components/ui/choice";
import { Modal } from "@/components/ui/dialog";
import { Field, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { blockSchedule, previewBlockConflicts } from "@/lib/data/bookings/actions";
import type { CourtBlock } from "@/lib/data/types";
import { minutesOf, toIso, weekdayLabels, weekdayOf } from "@/lib/dates";

import { useBookingTools } from "./booking-tools";

type Prefill = { day: string; courtIds?: string[]; from?: string };

/** Paper "Panel / 02a – Bloquear horario". */
export function BlockScheduleModal({ open, prefill, onClose }: { open: boolean; prefill: Prefill; onClose: () => void }) {
  if (!open) return null;
  return <BlockForm prefill={prefill} onClose={onClose} />;
}

function BlockForm({ prefill, onClose }: { prefill: Prefill; onClose: () => void }) {
  const { data } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [courtIds, setCourtIds] = useState<string[]>(prefill.courtIds ?? []);
  const [day, setDay] = useState(prefill.day);
  const [from, setFrom] = useState(prefill.from ?? "15:00");
  const [to, setTo] = useState(() => {
    const start = minutesOf(prefill.from ?? "15:00") + 120;
    return `${String(Math.min(Math.floor(start / 60), 23)).padStart(2, "0")}:${String(start % 60).padStart(2, "0")}`;
  });
  const [reason, setReason] = useState<CourtBlock["reason"]>("mantenimiento");
  const [repeat, setRepeat] = useState(false);
  const [conflicts, setConflicts] = useState<{ name: string; court: string; time: string }[]>([]);

  const valid = courtIds.length > 0 && minutesOf(to) > minutesOf(from);
  const hours = (minutesOf(to) - minutesOf(from)) / 60;

  // Warn about bookings the block would cancel, as the user edits the form.
  useEffect(() => {
    if (!valid) return;
    let cancelled = false;
    previewBlockConflicts({ courtIds, day, from, to, reason, repeatWeekly: false }).then((result) => {
      if (!cancelled) setConflicts(result.ok ? result.data : []);
    });
    return () => {
      cancelled = true;
    };
  }, [courtIds, day, from, to, reason, valid]);

  const toggleCourt = (id: string) =>
    setCourtIds((current) => (current.includes(id) ? current.filter((c) => c !== id) : [...current, id]));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await blockSchedule({ courtIds, day, from, to, reason, repeatWeekly: repeat });
      if (!result.ok) return setError(result.error);
      toast(
        result.data.cancelled
          ? `Horario bloqueado · ${result.data.cancelled} ${result.data.cancelled === 1 ? "reserva cancelada" : "reservas canceladas"}`
          : "Horario bloqueado",
      );
      onClose();
    });
  };

  const selectedNames = data.courts.filter((c) => courtIds.includes(c.id)).map((c) => c.shortName);

  return (
    <Modal
      open
      onClose={onClose}
      title="Bloquear horario"
      subtitle="Las canchas quedan tomadas y no se pueden reservar desde la app"
      footer={
        <>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-caption font-semibold text-ink-muted">Bloqueo</span>
            <span className="font-display text-title-2 text-ink">
              {valid ? `${hours.toLocaleString("es-AR")} h · ${courtIds.length} ${courtIds.length === 1 ? "cancha" : "canchas"}` : "—"}
            </span>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" onClick={submit} disabled={pending || !valid}>
            {pending ? "Bloqueando…" : "Bloquear horario"}
          </Button>
        </>
      }
    >
      <Field
        label="Canchas"
        message={selectedNames.length ? `${selectedNames.join(" y ")} · podés elegir varias` : "Elegí una o varias canchas"}
      >
        <TileGroup
          label="Canchas"
          value={courtIds}
          onChange={toggleCourt}
          options={data.courts.map((court) => ({ value: court.id, label: court.shortName }))}
        />
      </Field>

      <div className="flex gap-3">
        <TextField label="Día" type="date" value={day} min={data.today} onChange={(e) => setDay(e.target.value)} className="flex-1" />
        <TextField label="Desde" type="time" step={1800} value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1" />
        <TextField
          label="Hasta"
          type="time"
          step={1800}
          value={to}
          onChange={(e) => setTo(e.target.value)}
          className="flex-1"
          error={courtIds.length && minutesOf(to) <= minutesOf(from) ? "Tiene que ser después del inicio" : undefined}
        />
      </div>

      <Field label="Motivo">
        <ChipGroup
          label="Motivo"
          value={reason}
          onChange={setReason}
          options={[
            { value: "mantenimiento", label: "Mantenimiento" },
            { value: "clase", label: "Clase" },
            { value: "evento", label: "Evento" },
            { value: "otro", label: "Otro" },
          ]}
        />
      </Field>

      {valid && conflicts.length > 0 && (
        <Callout tone="warning" title={`${conflicts.length} ${conflicts.length === 1 ? "reserva choca" : "reservas chocan"} con este horario`}>
          {conflicts.map((c) => `${c.name} · ${c.court} · ${c.time.split(" · ")[1]}`).join(", ")}. Se cancelan, les avisamos por push
          y les devolvemos la seña.
        </Callout>
      )}

      <SwitchRow
        title="Repetir cada semana"
        description={`Bloquea todos los ${weekdayLabels[weekdayOf(toIso(day, "12:00"))].plural} de ${from} a ${to} · 8 semanas`}
        checked={repeat}
        onChange={setRepeat}
      />

      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}
