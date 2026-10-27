"use client";

import { createContext, useContext, useState, useTransition, type ReactNode } from "react";

import { useBookingTools } from "@/components/bookings/booking-tools";
import { MemberPicker, type MemberOption } from "@/components/members/member-picker";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ChipGroup, ChoiceCard, Segmented, TileGroup } from "@/components/ui/choice";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Field, TextField, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { priceFor } from "@/lib/data/club/pricing";
import { approveFixedSlot, createFixedSlot, rejectFixedSlot } from "@/lib/data/fixed-slots/actions";
import { weekdays, type Court, type FixedSlot, type Weekday } from "@/lib/data/types";
import { dayKey, hhmm, minutesOf, shortDateTime, time as timeOf, toIso, weekdayLabels, weekdayOf } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

type Ctx = { openLoad: () => void; openReject: (slot: FixedSlot) => void };
const FixedSlotContext = createContext<Ctx | null>(null);

function useFixedSlotTools() {
  const ctx = useContext(FixedSlotContext);
  if (!ctx) throw new Error("useFixedSlotTools must be used inside <FixedSlotTools>");
  return ctx;
}

/** Hosts "Cargar turno fijo" and the reject dialog for this section. */
export function FixedSlotTools({
  courts,
  members,
  today,
  activeSlots,
  children,
}: {
  courts: Court[];
  members: MemberOption[];
  today: string;
  /** Used to warn when a new fixed slot would overlap an existing one. */
  activeSlots: FixedSlot[];
  children: ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const [rejecting, setRejecting] = useState<FixedSlot | null>(null);
  return (
    <FixedSlotContext.Provider value={{ openLoad: () => setLoading(true), openReject: setRejecting }}>
      {children}
      {loading && <LoadFixedSlotModal courts={courts} members={members} today={today} activeSlots={activeSlots} onClose={() => setLoading(false)} />}
      {rejecting && <RejectDialog slot={rejecting} courts={courts} onClose={() => setRejecting(null)} />}
    </FixedSlotContext.Provider>
  );
}

export function LoadFixedSlotButton() {
  const { openLoad } = useFixedSlotTools();
  return (
    <Button icon="plus" onClick={openLoad}>
      Cargar turno fijo
    </Button>
  );
}

/** A request from the app with Rechazar / Aprobar (Paper "Panel / 05"). */
export function RequestCard({ slot, description, suggestedCourt }: { slot: FixedSlot; description: string; suggestedCourt?: string }) {
  const { openReject } = useFixedSlotTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const ok = slot.availability?.ok ?? true;

  const approve = () =>
    startTransition(async () => {
      const result = await approveFixedSlot({ id: slot.id });
      toast(result.ok ? `Turno fijo aprobado · le avisamos a ${slot.holder.name.split(" ")[0]}` : result.error, result.ok ? "success" : "error");
    });

  return (
    <div className="flex flex-col gap-2.5 rounded-md bg-surface-muted p-3.5">
      <div className="flex flex-col gap-0.5">
        <p className="text-label font-bold leading-[18px] text-ink">{slot.holder.name}</p>
        <p className="text-body-sm font-medium text-ink-muted">{description}</p>
      </div>
      {slot.availability && (
        <p className={ok ? "flex items-center gap-1.5 text-caption font-semibold text-success" : "flex items-center gap-1.5 text-caption font-semibold text-warning"}>
          <Icon name={ok ? "check" : "alert"} size={14} strokeWidth={ok ? 3 : 2} />
          {slot.availability.text}
        </p>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => openReject(slot)}
          className="h-9 flex-1 rounded-control border-[1.5px] border-line bg-white text-body-sm font-semibold text-ink hover:bg-field"
        >
          Rechazar
        </button>
        <button
          type="button"
          onClick={approve}
          disabled={pending}
          className="h-9 flex-1 rounded-control bg-elite-blue text-body-sm font-semibold text-white hover:bg-deep-blue disabled:opacity-60"
        >
          {suggestedCourt ? `Aprobar en ${suggestedCourt}` : "Aprobar"}
        </button>
      </div>
    </div>
  );
}

// ── Rechazar ──────────────────────────────────────────────────────────

function RejectDialog({ slot, courts, onClose }: { slot: FixedSlot; courts: Court[]; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState<"sin-cancha" | "horario-club" | "otro">("sin-cancha");
  const offerCourt = courts.find((c) => c.id === (slot.availability?.suggestedCourtId ?? "c2")) ?? courts[0]!;
  const offerTime = hhmm(minutesOf(slot.time) + 90);
  const [offer, setOffer] = useState(true);

  const reasons = { "sin-cancha": "No hay cancha fija libre", "horario-club": "Horario del club", otro: "Otro" } as const;

  const confirm = () =>
    startTransition(async () => {
      const result = await rejectFixedSlot({
        id: slot.id,
        reason: reasons[reason],
        offer: offer ? { courtId: offerCourt.id, time: offerTime } : undefined,
      });
      toast(result.ok ? (offer ? "Pedido rechazado · le ofrecimos otro horario" : "Pedido rechazado") : result.error, result.ok ? "success" : "error");
      if (result.ok) onClose();
    });

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={confirm}
      pending={pending}
      icon="repeat"
      title={`¿Rechazar el pedido de ${slot.holder.name}?`}
      description={`${weekdayLabels[slot.weekday].long} ${slot.time} · ${courts.find((c) => c.id === slot.courtId)?.name ?? "cualquier cancha"} · ${slot.durationMin} min. Le avisamos por push con el motivo.`}
      confirmLabel={offer ? "Rechazar y ofrecer" : "Rechazar pedido"}
    >
      <Field label="Motivo">
        <ChipGroup
          label="Motivo"
          value={reason}
          onChange={setReason}
          options={Object.entries(reasons).map(([value, label]) => ({ value: value as keyof typeof reasons, label }))}
        />
      </Field>
      <ChoiceCard
        indicator="checkbox"
        title={`Ofrecerle ${weekdayLabels[slot.weekday].plural} ${offerTime} · ${offerCourt.name}`}
        description="Libre las próximas 8 semanas. Lo acepta desde la app."
        selected={offer}
        onSelect={() => setOffer((value) => !value)}
      />
    </ConfirmDialog>
  );
}

// ── Cargar turno fijo ─────────────────────────────────────────────────

function LoadFixedSlotModal({
  courts,
  members,
  today,
  activeSlots,
  onClose,
}: {
  courts: Court[];
  members: MemberOption[];
  today: string;
  activeSlots: FixedSlot[];
  onClose: () => void;
}) {
  const { data } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [memberId, setMemberId] = useState<string | null>(null);
  const [weekday, setWeekday] = useState<Weekday>("mar");
  const [time, setTime] = useState("20:00");
  const [duration, setDuration] = useState<"60" | "90">("90");
  const [courtId, setCourtId] = useState<string>(courts[1]?.id ?? courts[0]!.id);
  const [since, setSince] = useState(today);

  const durationMin = Number(duration) as 60 | 90;
  // Any upcoming date on that weekday gives the right band and day type.
  const sample = toIso(since, time || "20:00");
  const { price, band } = priceFor(data.pricing.rates, sample, durationMin);
  const court = courts.find((c) => c.id === courtId);

  // Overlap with another fixed slot, or with a booking in the next two weeks on that weekday.
  const startMin = minutesOf(time || "00:00");
  const overlaps = (otherStart: number, otherMinutes: number) => otherStart < startMin + durationMin && otherStart + otherMinutes > startMin;
  const slotClash = activeSlots.find((s) => s.courtId === courtId && s.weekday === weekday && overlaps(minutesOf(s.time), s.durationMin));
  const bookingClash = data.bookings.find(
    (b) =>
      !b.cancelled &&
      !b.fixedSlotId &&
      b.courtId === courtId &&
      dayKey(b.start) >= since &&
      weekdayOf(b.start) === weekday &&
      overlaps(minutesOf(timeOf(b.start)), b.durationMin),
  );

  const submit = () => {
    setError(null);
    if (!memberId) return setError("Elegí el titular del turno fijo.");
    startTransition(async () => {
      const result = await createFixedSlot({ memberId, weekday, time, durationMin, courtId, since });
      if (!result.ok) return setError(result.error);
      toast("Turno fijo cargado");
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title="Cargar turno fijo"
      subtitle="Se reserva solo todas las semanas, a nombre del titular"
      footer={
        <>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-caption font-semibold text-ink-muted">
              {band?.kind === "pico" ? "Pico" : "Valle"} · {durationMin} min · paga en el club
            </span>
            <span className="font-display text-title-2 text-ink">{formatMoney(price)} / semana</span>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" onClick={submit} disabled={pending}>
            Cargar turno fijo
          </Button>
        </>
      }
    >
      <Field label="Titular">
        <MemberPicker members={members} value={memberId} onChange={setMemberId} />
      </Field>
      <Field label="Todos los">
        <TileGroup
          label="Día de la semana"
          value={[weekday]}
          onChange={setWeekday}
          options={weekdays.map((day) => ({ value: day, label: weekdayLabels[day].short }))}
        />
      </Field>
      <div className="flex gap-3">
        <TextField label="Hora" type="time" step={1800} value={time} onChange={(e) => setTime(e.target.value)} className="flex-1" />
        <Field label="Duración" className="w-[140px] shrink-0">
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
        <Field label="Cancha" className="flex-1">
          <Select variant="field" label="Cancha" value={courtId} onChange={setCourtId} options={courts.map((c) => ({ value: c.id, label: c.name }))} />
        </Field>
      </div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <p className="text-body-sm font-bold text-ink">Empieza</p>
          <p className="text-caption font-medium text-ink-muted">Sigue hasta que el titular lo libere o lo des de baja</p>
        </div>
        <TextInput aria-label="Empieza el" type="date" value={since} min={today} onChange={(e) => setSince(e.target.value)} className="w-[180px]" />
      </div>
      {slotClash ? (
        <Callout tone="warning">
          Choca con el turno fijo de {slotClash.holder.name} ({weekdayLabels[weekday].plural} {slotClash.time}). Elegí otra cancha u horario.
        </Callout>
      ) : bookingClash ? (
        <Callout tone="warning">
          {court?.name} tiene una reserva de {bookingClash.organizer.name} el {shortDateTime(bookingClash.start)}. El turno fijo arranca la
          semana siguiente o mové esa reserva.
        </Callout>
      ) : (
        <Callout tone="success" icon="check">
          {court?.name} libre los {weekdayLabels[weekday].plural} {time} las próximas semanas
        </Callout>
      )}
      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}
