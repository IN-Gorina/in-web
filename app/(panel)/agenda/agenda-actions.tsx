"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

import { useBookingTools } from "@/components/bookings/booking-tools";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { addDays } from "@/lib/dates";

/** ‹ Hoy › day switcher (Paper Agenda topbar). */
export function DayNav({ day, today }: { day: string; today: string }) {
  const href = (target: string) => (target === today ? "/agenda" : `/agenda?dia=${target}`);
  return (
    <div className="flex h-10 items-center rounded-control border border-line bg-white">
      <Link href={href(addDays(day, -1))} aria-label="Día anterior" className="flex size-10 items-center justify-center text-ink hover:bg-field">
        <Icon name="chevron-left" size={18} strokeWidth={2.4} />
      </Link>
      <Link
        href="/agenda"
        aria-current={day === today ? "date" : undefined}
        className="px-2 text-label font-semibold text-ink hover:text-elite-blue"
      >
        Hoy
      </Link>
      <Link href={href(addDays(day, 1))} aria-label="Día siguiente" className="flex size-10 items-center justify-center text-ink hover:bg-field">
        <Icon name="chevron-right" size={18} strokeWidth={2.4} />
      </Link>
    </div>
  );
}

export function AgendaActions({ day }: { day: string }) {
  const { openNew, openBlock } = useBookingTools();
  return (
    <>
      <Button variant="secondary" icon="lock" onClick={() => openBlock({ day })}>
        Bloquear horario
      </Button>
      <Button icon="plus" onClick={() => openNew({ day })}>
        Nueva reserva
      </Button>
    </>
  );
}

/** Opens Nueva reserva when arriving from "Nueva reserva" on Resumen (/agenda?nueva=1). */
export function OpenNewOnLoad({ day }: { day: string }) {
  const { openNew } = useBookingTools();
  const done = useRef(false);
  useEffect(() => {
    if (done.current) return;
    done.current = true;
    openNew({ day });
    // Drop ?nueva=1 without a navigation, which would remount the page and close the modal.
    window.history.replaceState(null, "", "/agenda");
  }, [day, openNew]);
  return null;
}
