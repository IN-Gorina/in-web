"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import type { MemberOption } from "@/components/members/member-picker";
import type { PricingTable } from "@/lib/data/club/pricing";
import type { Booking, Court } from "@/lib/data/types";

import { BlockScheduleModal } from "./block-modal";
import { BookingDrawer } from "./booking-drawer";
import { CancelBookingDialog } from "./cancel-dialog";
import { MoveBookingModal } from "./move-modal";
import { NewBookingModal, type NewBookingPrefill } from "./new-booking-modal";
import { RegisterPaymentModal } from "./payment-modal";

/** Everything the booking modals need from the server, loaded once per page. */
export type BookingToolsData = {
  courts: Court[];
  members: MemberOption[];
  pricing: PricingTable;
  today: string;
  canRefund: boolean;
  staffName: string;
  /** Bookings the page knows about: the drawer reads fresh data from here, the cobro modal picks from it. */
  bookings: Booking[];
};

type Open =
  | { kind: "none" }
  | { kind: "new"; prefill: NewBookingPrefill }
  | { kind: "block"; prefill: { day: string; courtIds?: string[]; from?: string } }
  | { kind: "detail"; booking: Booking }
  | { kind: "cancel"; booking: Booking }
  | { kind: "payment"; booking?: Booking }
  | { kind: "move"; booking: Booking };

type Tools = {
  data: BookingToolsData;
  courtById: (id: string) => Court | undefined;
  openNew: (prefill?: NewBookingPrefill) => void;
  openBlock: (prefill?: { day?: string; courtIds?: string[]; from?: string }) => void;
  openDetail: (booking: Booking) => void;
  openCancel: (booking: Booking) => void;
  openPayment: (booking?: Booking) => void;
  openMove: (booking: Booking) => void;
};

const ToolsContext = createContext<Tools | null>(null);

/**
 * Hosts the booking modals (Nueva reserva, Bloquear horario, detalle, cobro, mover, cancelar)
 * so Agenda, Reservas and Pagos open the same ones.
 */
export function BookingToolsProvider({ data, children }: { data: BookingToolsData; children: ReactNode }) {
  const [open, setOpen] = useState<Open>({ kind: "none" });
  const close = useCallback(() => setOpen({ kind: "none" }), []);

  const tools = useMemo<Tools>(() => {
    const courtById = (id: string) => data.courts.find((court) => court.id === id);
    return {
      data,
      courtById,
      openNew: (prefill = {}) => setOpen({ kind: "new", prefill: { day: data.today, ...prefill } }),
      openBlock: (prefill = {}) => setOpen({ kind: "block", prefill: { day: data.today, ...prefill } }),
      openDetail: (booking) => setOpen({ kind: "detail", booking }),
      openCancel: (booking) => setOpen({ kind: "cancel", booking }),
      openPayment: (booking) => setOpen({ kind: "payment", booking }),
      openMove: (booking) => setOpen({ kind: "move", booking }),
    };
  }, [data]);

  // Keep the drawer showing fresh data after an action revalidates the page.
  const fresh = (booking: Booking) => data.bookings.find((b) => b.id === booking.id) ?? booking;

  return (
    <ToolsContext.Provider value={tools}>
      {children}
      <NewBookingModal open={open.kind === "new"} prefill={open.kind === "new" ? open.prefill : {}} onClose={close} />
      <BlockScheduleModal open={open.kind === "block"} prefill={open.kind === "block" ? open.prefill : { day: data.today }} onClose={close} />
      <BookingDrawer booking={open.kind === "detail" ? fresh(open.booking) : null} onClose={close} />
      <CancelBookingDialog booking={open.kind === "cancel" ? open.booking : null} onClose={close} />
      <RegisterPaymentModal open={open.kind === "payment"} booking={open.kind === "payment" ? open.booking : undefined} onClose={close} />
      <MoveBookingModal booking={open.kind === "move" ? open.booking : null} onClose={close} />
    </ToolsContext.Provider>
  );
}

export function useBookingTools(): Tools {
  const tools = useContext(ToolsContext);
  if (!tools) throw new Error("useBookingTools must be used inside <BookingToolsProvider>");
  return tools;
}
