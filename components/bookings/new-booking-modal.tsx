"use client";

import { useState, useTransition } from "react";

import { MemberPicker } from "@/components/members/member-picker";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ChoiceCard, Segmented, SwitchRow, TileGroup } from "@/components/ui/choice";
import { Modal } from "@/components/ui/dialog";
import { Field, FieldLabel, TextField, TextInput } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { createBooking } from "@/lib/data/bookings/actions";
import { bandLabel } from "@/lib/data/bookings/presentation";
import { priceFor } from "@/lib/data/club/pricing";
import { toIso, weekdayLabels, weekdayOf } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { useBookingTools } from "./booking-tools";

export type NewBookingPrefill = { day?: string; time?: string; courtId?: string; memberId?: string };

const courtCaption = (type: string) => (type === "techada" ? "Techada" : "Descubierta");

/** Paper "Panel / 04 – Nueva reserva manual": bookings taken by phone or at the desk. */
export function NewBookingModal({ open, prefill, onClose }: { open: boolean; prefill: NewBookingPrefill; onClose: () => void }) {
  if (!open) return null;
  return <NewBookingForm prefill={prefill} onClose={onClose} />;
}

function NewBookingForm({ prefill, onClose }: { prefill: NewBookingPrefill; onClose: () => void }) {
  const { data } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const [courtId, setCourtId] = useState(prefill.courtId ?? data.courts[0]!.id);
  const [day, setDay] = useState(prefill.day ?? data.today);
  const [time, setTime] = useState(prefill.time ?? "20:30");
  const [duration, setDuration] = useState<"60" | "90">("90");
  const [who, setWho] = useState<"socio" | "invitado">("socio");
  const [memberId, setMemberId] = useState<string | null>(prefill.memberId ?? null);
  const [guestName, setGuestName] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [payment, setPayment] = useState<"club" | "sena">("club");
  const [repeat, setRepeat] = useState(false);

  const start = toIso(day, time || "00:00");
  const durationMin = Number(duration) as 60 | 90;
  const { price } = priceFor(data.pricing.rates, start, durationMin);
  const isDown = (courtCheck: (typeof data.courts)[number]) =>
    Boolean(courtCheck.maintenance && new Date(courtCheck.maintenance.until) > new Date(start));
  const court = data.courts.find((c) => c.id === courtId)!;
  const downCourts = data.courts.filter(isDown);

  const submit = () => {
    setError(null);
    if (who === "socio" && !memberId) return setError("Elegí a qué socio va la reserva.");
    startTransition(async () => {
      const result = await createBooking({
        courtId,
        day,
        time,
        durationMin,
        organizer: who === "socio" ? { kind: "socio", memberId: memberId! } : { kind: "invitado", name: guestName, phone: guestPhone },
        payment,
        repeatWeekly: repeat,
      });
      if (!result.ok) return setError(result.error);
      toast(repeat ? "Reserva creada y turno fijo cargado" : "Reserva creada");
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Nueva reserva"
      subtitle="Para reservas por teléfono o en el mostrador"
      footer={
        <>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-caption font-semibold text-ink-muted">
              {bandLabel(time)} · {durationMin} min
            </span>
            <span className="font-display text-title-2 text-ink">{formatMoney(price)}</span>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" onClick={submit} disabled={pending}>
            {pending ? "Creando…" : "Crear reserva"}
          </Button>
        </>
      }
    >
      <Field
        label="Cancha"
        message={[
          `${court.shortName} · ${courtCaption(court.type)}`,
          downCourts.length ? `${downCourts.map((c) => c.shortName).join(", ")} en mantenimiento` : null,
        ]
          .filter(Boolean)
          .join(" · ")}
      >
        <TileGroup
          label="Cancha"
          value={[courtId]}
          onChange={setCourtId}
          options={data.courts.map((c) => ({ value: c.id, label: c.shortName, disabled: isDown(c) }))}
        />
      </Field>

      <div className="flex gap-3">
        <TextField label="Día" type="date" value={day} min={data.today} onChange={(e) => setDay(e.target.value)} className="flex-1" />
        <TextField label="Hora" type="time" step={1800} value={time} onChange={(e) => setTime(e.target.value)} className="flex-1" />
        <Field label="Duración" className="w-[150px] shrink-0">
          <Segmented
            variant="field"
            label="Duración"
            value={duration}
            onChange={setDuration}
            options={[
              { value: "60", label: "60′" },
              { value: "90", label: "90′" },
            ]}
          />
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <FieldLabel label="A nombre de" />
          <Segmented
            variant="field"
            size="sm"
            label="A nombre de"
            value={who}
            onChange={setWho}
            options={[
              { value: "socio", label: "Socio" },
              { value: "invitado", label: "Invitado sin app" },
            ]}
          />
        </div>
        {who === "socio" ? (
          <MemberPicker members={data.members} value={memberId} onChange={setMemberId} />
        ) : (
          <div className="flex gap-3">
            <TextInput aria-label="Nombre del invitado" placeholder="Nombre y apellido" value={guestName} onChange={(e) => setGuestName(e.target.value)} className="flex-1" />
            <TextInput aria-label="Teléfono del invitado" placeholder="Teléfono" type="tel" value={guestPhone} onChange={(e) => setGuestPhone(e.target.value)} className="w-[180px]" />
          </div>
        )}
      </div>

      <Field label="Cobro">
        <div className="flex gap-2">
          <ChoiceCard
            className="flex-1"
            title="Paga todo en el club"
            description="Sin seña · queda confirmada"
            selected={payment === "club"}
            onSelect={() => setPayment("club")}
          />
          <ChoiceCard
            className="flex-1"
            title="Seña cobrada acá"
            description={`${formatMoney(data.pricing.depositAmount)} · efectivo o transferencia`}
            selected={payment === "sena"}
            onSelect={() => setPayment("sena")}
          />
        </div>
      </Field>

      <SwitchRow
        title="Repetir cada semana"
        description={`Lo convierte en turno fijo · ${weekdayLabels[weekdayOf(start)].plural} ${time}`}
        checked={repeat}
        onChange={setRepeat}
      />

      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}
