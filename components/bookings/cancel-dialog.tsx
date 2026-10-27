"use client";

import { useState, useTransition } from "react";

import { Callout } from "@/components/ui/callout";
import { ChoiceCard } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { cancelBooking } from "@/lib/data/bookings/actions";
import type { Booking } from "@/lib/data/types";
import { shortDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { useBookingTools } from "./booking-tools";

/** Paper "Panel / 14 – Cancelar reserva": asks whether to refund the deposit. */
export function CancelBookingDialog({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  if (!booking) return null;
  return <CancelForm booking={booking} onClose={onClose} />;
}

function CancelForm({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { data, courtById } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const hasDeposit = booking.depositStatus === "pagada";
  const [refund, setRefund] = useState(hasDeposit && data.canRefund);
  const [error, setError] = useState<string | null>(null);

  const confirm = () =>
    startTransition(async () => {
      const result = await cancelBooking({ id: booking.id, refund: hasDeposit && refund });
      if (!result.ok) return setError(result.error);
      toast(hasDeposit && refund ? "Reserva cancelada · seña devuelta" : "Reserva cancelada");
      onClose();
    });

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      onConfirm={confirm}
      pending={pending}
      icon="calendar"
      title={`¿Cancelar la reserva de ${booking.organizer.name}?`}
      description={`${courtById(booking.courtId)?.name} · ${shortDateTime(booking.start)}. El turno queda libre en la app y le avisamos por push.`}
      confirmLabel={hasDeposit && refund ? "Cancelar y devolver" : "Cancelar reserva"}
    >
      {hasDeposit && (
        <div className="flex flex-col gap-2">
          <ChoiceCard
            indicator="radio"
            title={`Devolver la seña · ${formatMoney(booking.deposit)}`}
            description={data.canRefund ? "Vuelve a su Mercado Pago en 1 a 3 días" : "Solo un administrador puede devolver señas"}
            selected={refund}
            onSelect={() => data.canRefund && setRefund(true)}
            className={data.canRefund ? undefined : "opacity-60"}
          />
          <ChoiceCard
            indicator="radio"
            title="Quedarse con la seña"
            description="Si el socio avisó con menos de 24 h"
            selected={!refund}
            onSelect={() => setRefund(false)}
          />
        </div>
      )}
      {error && <Callout tone="danger">{error}</Callout>}
    </ConfirmDialog>
  );
}
