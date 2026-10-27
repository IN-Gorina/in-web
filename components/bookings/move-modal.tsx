"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { TileGroup } from "@/components/ui/choice";
import { Modal } from "@/components/ui/dialog";
import { Field, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { moveBooking } from "@/lib/data/bookings/actions";
import type { Booking } from "@/lib/data/types";
import { dayKey, shortDateTime, time } from "@/lib/dates";

import { useBookingTools } from "./booking-tools";

/** Moves a booking to another court or time; the member is notified. */
export function MoveBookingModal({ booking, onClose }: { booking: Booking | null; onClose: () => void }) {
  if (!booking) return null;
  return <MoveForm booking={booking} onClose={onClose} />;
}

function MoveForm({ booking, onClose }: { booking: Booking; onClose: () => void }) {
  const { data, courtById } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [courtId, setCourtId] = useState(booking.courtId);
  const [day, setDay] = useState(dayKey(booking.start));
  const [start, setStart] = useState(time(booking.start));

  const submit = () => {
    setError(null);
    startTransition(async () => {
      const result = await moveBooking({ id: booking.id, courtId, day, time: start });
      if (!result.ok) return setError(result.error);
      toast("Reserva movida · le avisamos al socio");
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={500}
      title="Mover de horario"
      subtitle={`${booking.organizer.name} · ahora ${courtById(booking.courtId)?.shortName} · ${shortDateTime(booking.start)}`}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" onClick={submit} disabled={pending}>
            Mover reserva
          </Button>
        </>
      }
    >
      <Field label="Cancha">
        <TileGroup
          label="Cancha"
          value={[courtId]}
          onChange={setCourtId}
          options={data.courts.map((court) => ({ value: court.id, label: court.shortName }))}
        />
      </Field>
      <div className="flex gap-3">
        <TextField label="Día" type="date" value={day} min={data.today} onChange={(e) => setDay(e.target.value)} className="flex-1" />
        <TextField label="Hora" type="time" step={1800} value={start} onChange={(e) => setStart(e.target.value)} className="flex-1" />
      </div>
      <Callout tone="info">El precio y la seña no cambian. Le avisamos al socio por push.</Callout>
      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}
