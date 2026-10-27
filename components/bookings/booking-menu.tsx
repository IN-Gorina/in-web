"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";

import { Icon } from "@/components/ui/icon";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { resendDepositLink } from "@/lib/data/bookings/actions";
import { balanceDue } from "@/lib/data/bookings/presentation";
import type { Booking } from "@/lib/data/types";

import { useBookingTools } from "./booking-tools";

/** The "···" menu on a booking row (Paper "Panel / 03a – Reservas · menú de fila"). */
export function BookingMenu({ booking }: { booking: Booking }) {
  const { openDetail, openPayment, openMove, openCancel } = useBookingTools();
  const router = useRouter();
  const toast = useToast();
  const [, startTransition] = useTransition();
  const active = !booking.cancelled;
  const due = balanceDue(booking);

  const items: MenuEntry[] = [{ label: "Ver detalle", icon: "eye", onSelect: () => openDetail(booking) }];
  if (active && ((due ?? 0) > 0 || booking.depositStatus === "pendiente"))
    items.push({ label: "Registrar cobro", icon: "cash", onSelect: () => openPayment(booking) });
  if (active && booking.depositStatus === "pendiente")
    items.push({
      label: "Reenviar link de seña",
      icon: "send",
      onSelect: () =>
        startTransition(async () => {
          const result = await resendDepositLink(booking.id);
          toast(result.ok ? "Le reenviamos el link de seña" : result.error, result.ok ? "success" : "error");
        }),
    });
  if (active) items.push({ label: "Mover a otro horario", icon: "calendar", onSelect: () => openMove(booking) });
  if (booking.organizer.memberId)
    items.push({ label: "Ver socio", icon: "user", onSelect: () => router.push(`/socios/${booking.organizer.memberId}`) });
  if (active) {
    items.push({ type: "separator" });
    items.push({ label: "Cancelar reserva", icon: "circle-x", tone: "danger", onSelect: () => openCancel(booking) });
  }

  return (
    <Menu
      items={items}
      trigger={(props) => (
        <button
          type="button"
          aria-label={`Acciones de la reserva de ${booking.organizer.name}`}
          {...props}
          onClick={(event) => {
            event.stopPropagation();
            props.onClick(event);
          }}
          className={cn(
            "flex size-7 items-center justify-center rounded-[6px] text-ink-muted hover:bg-blue-tint",
            props["aria-expanded"] && "bg-blue-tint",
          )}
        >
          <Icon name="dots" size={18} strokeWidth={3} />
        </button>
      )}
    />
  );
}
