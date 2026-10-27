"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { ChoiceCard, Segmented } from "@/components/ui/choice";
import { Modal } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { useDismiss } from "@/components/ui/use-dismiss";
import { cn } from "@/lib/cn";
import { registerPayment } from "@/lib/data/bookings/actions";
import { balanceDue } from "@/lib/data/bookings/presentation";
import type { Booking, PaymentConcept } from "@/lib/data/types";
import { shortDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { useBookingTools } from "./booking-tools";

type Concept = Extract<PaymentConcept, "saldo" | "sena" | "otro">;
type Method = "efectivo" | "transferencia" | "qr";

/** Paper "Panel / 06a – Registrar cobro": what a member pays at the desk. */
export function RegisterPaymentModal({ open, booking, onClose }: { open: boolean; booking?: Booking; onClose: () => void }) {
  if (!open) return null;
  return <PaymentForm initial={booking} onClose={onClose} />;
}

function suggestedAmount(booking: Booking | undefined, concept: Concept): string {
  if (!booking) return "";
  if (concept === "sena") return String(booking.deposit || "");
  if (concept === "saldo") return String(balanceDue(booking) ?? "");
  return "";
}

function PaymentForm({ initial, onClose }: { initial?: Booking; onClose: () => void }) {
  const { data, courtById } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const payable = useMemo(
    () => data.bookings.filter((b) => !b.cancelled && ((balanceDue(b) ?? 0) > 0 || b.depositStatus === "pendiente")),
    [data.bookings],
  );
  const [bookingId, setBookingId] = useState<string | null>(initial?.id ?? null);
  const booking = data.bookings.find((b) => b.id === bookingId);
  const initialConcept: Concept = !initial ? "otro" : initial.depositStatus === "pendiente" ? "sena" : "saldo";
  const [concept, setConcept] = useState<Concept>(initialConcept);
  const [amount, setAmount] = useState(suggestedAmount(initial, initialConcept));
  const [method, setMethod] = useState<Method>("efectivo");
  const [note, setNote] = useState("");
  const [payer, setPayer] = useState("");

  const pick = (next: Booking | null) => {
    setBookingId(next?.id ?? null);
    const nextConcept: Concept = next?.depositStatus === "pendiente" ? "sena" : next ? "saldo" : "otro";
    setConcept(nextConcept);
    setAmount(suggestedAmount(next ?? undefined, nextConcept));
  };

  const value = Number(amount.replace(/\D/g, ""));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await registerPayment({
        bookingId: booking?.id,
        memberName: booking ? undefined : payer,
        concept,
        amount: value,
        method,
        note,
      });
      if (!result.ok) return setError(result.error);
      toast(`Cobro registrado · ${result.data.amount}`);
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title="Registrar cobro"
      subtitle="Lo que el socio paga en el mostrador"
      footer={
        <>
          <div className="flex flex-1 flex-col gap-0.5">
            <span className="text-caption font-semibold text-ink-muted">Queda a nombre de</span>
            <span className="text-body-sm font-bold text-ink">{data.staffName}</span>
          </div>
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" onClick={submit} disabled={pending || value <= 0}>
            {value > 0 ? `Registrar ${formatMoney(value)}` : "Registrar"}
          </Button>
        </>
      }
    >
      <Field label="Reserva">
        <BookingPicker
          bookings={payable}
          selected={booking}
          onPick={pick}
          describe={(b) => `${courtById(b.courtId)?.name} · ${shortDateTime(b.start)} · ${b.depositStatus === "pendiente" ? "seña pendiente" : b.depositStatus === "pagada" ? "seña pagada" : "paga en el club"}`}
        />
      </Field>
      {!booking && (
        <Field label="A nombre de">
          <TextInput placeholder="Nombre de quien paga" value={payer} onChange={(e) => setPayer(e.target.value)} />
        </Field>
      )}

      <div className="flex gap-3">
        <Field label="Concepto" className="flex-1">
          <Segmented
            variant="field"
            label="Concepto"
            value={concept}
            onChange={(next) => {
              setConcept(next);
              setAmount(suggestedAmount(booking, next));
            }}
            options={[
              { value: "saldo", label: "Saldo", disabled: !booking },
              { value: "sena", label: "Seña", disabled: !booking || booking.depositStatus === "pagada" },
              { value: "otro", label: "Otro" },
            ]}
          />
        </Field>
        <Field label="Monto" className="w-[180px] shrink-0">
          <TextInput
            inputMode="numeric"
            aria-label="Monto"
            value={value ? value.toLocaleString("es-AR") : ""}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0"
            trailing={<span className="order-first text-body font-semibold text-ink-muted">$</span>}
            className="[&>input]:font-bold"
          />
        </Field>
      </div>

      <Field label="Medio de pago">
        <div className="flex gap-2">
          <ChoiceCard className="flex-1" icon="cash" title="Efectivo" selected={method === "efectivo"} onSelect={() => setMethod("efectivo")} />
          <ChoiceCard className="flex-1" icon="transfer" title="Transferencia" selected={method === "transferencia"} onSelect={() => setMethod("transferencia")} />
          <ChoiceCard className="flex-1" icon="qrcode" title="QR / Posnet" selected={method === "qr"} onSelect={() => setMethod("qr")} />
        </div>
      </Field>

      <Field label="Nota" aside="Opcional">
        <TextInput placeholder="Ej: pagó también 2 tubos de pelotas" value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}

function BookingPicker({
  bookings,
  selected,
  onPick,
  describe,
}: {
  bookings: Booking[];
  selected: Booking | undefined;
  onPick: (booking: Booking | null) => void;
  describe: (booking: Booking) => string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  return (
    <div ref={ref} className="relative">
      {selected ? (
        <div className="flex h-[60px] items-center gap-3 rounded-md border-2 border-elite-blue bg-blue-tint px-3.5">
          <Avatar name={selected.organizer.name} tone="blue" size="sm" />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <p className="truncate text-label font-bold leading-[18px] text-ink">{selected.organizer.name}</p>
            <p className="truncate text-caption font-medium text-ink-muted">{describe(selected)}</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="text-body-sm font-bold text-link hover:underline">
            Cambiar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-11 w-full items-center justify-between rounded-control bg-field px-3.5 text-label font-semibold text-ink-muted hover:bg-blue-tint"
        >
          Sin reserva · elegí una para cobrar el saldo
          <Icon name="chevron-down" size={14} strokeWidth={2.5} />
        </button>
      )}
      {open && (
        <div className="absolute inset-x-0 top-full z-30 mt-1.5 flex max-h-72 flex-col overflow-y-auto rounded-[14px] border border-line bg-white p-1.5 shadow-menu">
          {bookings.map((booking) => (
            <button
              key={booking.id}
              type="button"
              onClick={() => {
                onPick(booking);
                setOpen(false);
              }}
              className={cn("flex flex-col rounded-sm px-2.5 py-2 text-left hover:bg-field", booking.id === selected?.id && "bg-field")}
            >
              <span className="text-label font-semibold text-ink">{booking.organizer.name}</span>
              <span className="text-caption font-medium text-ink-muted">{describe(booking)}</span>
            </button>
          ))}
          <div className="my-1 h-px bg-line" />
          <button
            type="button"
            onClick={() => {
              onPick(null);
              setOpen(false);
            }}
            className="rounded-sm px-2.5 py-2 text-left text-label font-semibold text-ink hover:bg-field"
          >
            Cobro sin reserva (pelotas, alquiler de paleta…)
          </button>
        </div>
      )}
    </div>
  );
}
