"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { useBookingTools } from "@/components/bookings/booking-tools";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/choice";
import { SearchInput } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableHeader, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { downloadCsv } from "@/lib/csv";
import type { Payment, PaymentMethod } from "@/lib/data/types";
import { addDays, dayKey, dayMonth, relativeDay, time } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

type Tab = "todos" | "cobrados" | "pendientes" | "reintegros";
type Range = "mes" | "semana" | "hoy";

const methods: Record<PaymentMethod, { label: string; icon: IconName | "mp" }> = {
  "mercado-pago": { label: "Mercado Pago", icon: "mp" },
  efectivo: { label: "Efectivo · recepción", icon: "cash" },
  transferencia: { label: "Transferencia", icon: "transfer" },
  qr: { label: "QR / Posnet", icon: "qrcode" },
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function RegisterPaymentButton() {
  const { openPayment } = useBookingTools();
  return (
    <Button icon="plus" onClick={() => openPayment()}>
      Registrar cobro en el club
    </Button>
  );
}

export function PaymentsTable({ payments, today, nowIso }: { payments: Payment[]; today: string; nowIso: string }) {
  const { data, openDetail } = useBookingTools();
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("todos");
  const [range, setRange] = useState<Range>("mes");
  const [query, setQuery] = useState("");

  const status = (payment: Payment): { label: string; tone: BadgeTone } => {
    switch (payment.status) {
      case "acreditado":
        return { label: "Acreditado", tone: "success" };
      case "pendiente":
        return { label: "Pendiente", tone: "neutral" };
      case "vence-pronto": {
        const booking = data.bookings.find((b) => b.id === payment.bookingId);
        const minutes = booking?.depositExpiresAt
          ? Math.max(Math.round((new Date(booking.depositExpiresAt).getTime() - new Date(nowIso).getTime()) / 60_000), 0)
          : null;
        return { label: minutes !== null ? `Vence en ${minutes} min` : "Vence pronto", tone: "warning" };
      }
      case "reintegrado":
        return { label: "Reintegrado", tone: "info" };
      case "rechazado":
        return { label: "Rechazado", tone: "danger" };
    }
  };

  const pendingCount = payments.filter((p) => p.status === "pendiente" || p.status === "vence-pronto").length;
  const from = range === "hoy" ? today : range === "semana" ? addDays(today, -6) : `${today.slice(0, 8)}01`;
  const rangeLabel = `${dayMonth(`${from}T12:00:00-03:00`)} – ${dayMonth(`${today}T12:00:00-03:00`)}`;

  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return payments.filter((payment) => {
      if (dayKey(payment.at) < from) return false;
      if (tab === "cobrados" && payment.status !== "acreditado") return false;
      if (tab === "pendientes" && payment.status !== "pendiente" && payment.status !== "vence-pronto") return false;
      if (tab === "reintegros" && payment.status !== "reintegrado") return false;
      if (q && !normalize(`${payment.memberName} ${payment.title} ${payment.operationId ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [payments, tab, from, query]);

  const exportCsv = () =>
    downloadCsv(
      `pagos-${today}.csv`,
      ["Fecha", "Hora", "Socio", "Concepto", "Detalle", "Medio", "Estado", "Monto", "ID operación", "Registró"],
      visible.map((p) => [
        dayKey(p.at),
        time(p.at),
        p.memberName,
        p.title,
        p.detail,
        methods[p.method].label,
        status(p).label,
        p.amount,
        p.operationId ?? (p.manual ? "Carga manual" : ""),
        p.registeredBy ?? "",
      ]),
    );

  const rowMenu = (payment: Payment): MenuEntry[] => {
    const booking = data.bookings.find((b) => b.id === payment.bookingId);
    const items: MenuEntry[] = [];
    if (booking) items.push({ label: "Ver reserva", icon: "eye", onSelect: () => openDetail(booking) });
    if (payment.memberId) items.push({ label: "Ver socio", icon: "user", onSelect: () => router.push(`/socios/${payment.memberId}`) });
    if (payment.operationId)
      items.push({
        label: "Copiar ID de operación",
        icon: "list",
        onSelect: () => {
          void navigator.clipboard?.writeText(payment.operationId!.replace("#", "").replaceAll(" ", ""));
          toast("ID copiado");
        },
      });
    if (items.length === 0) items.push({ label: "Sin acciones", disabled: true, onSelect: () => {} });
    return items;
  };

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <SearchInput placeholder="Buscar por socio u operación" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar pagos" />
        <Segmented
          label="Tipo de pago"
          value={tab}
          onChange={setTab}
          options={[
            { value: "todos", label: "Todos" },
            { value: "cobrados", label: "Cobrados" },
            { value: "pendientes", label: "Pendientes", count: pendingCount },
            { value: "reintegros", label: "Reintegros" },
          ]}
        />
        <Select
          label="Período"
          value={range}
          onChange={setRange}
          valueLabel={rangeLabel}
          icon={<Icon name="calendar" size={16} className="text-ink-muted" />}
          options={[
            { value: "mes", label: "Este mes" },
            { value: "semana", label: "Últimos 7 días" },
            { value: "hoy", label: "Hoy" },
          ]}
        />
        <span className="flex-1" />
        <Button variant="secondary" icon="download" onClick={exportCsv} disabled={visible.length === 0}>
          Exportar
        </Button>
      </div>

      <Table label="Pagos">
        <TableHeader>
          <TableHeaderCell width={80}>Fecha</TableHeaderCell>
          <TableHeaderCell width={150}>Socio</TableHeaderCell>
          <TableHeaderCell grow>Concepto</TableHeaderCell>
          <TableHeaderCell width={170}>Medio</TableHeaderCell>
          <TableHeaderCell width={130}>Estado</TableHeaderCell>
          <TableHeaderCell width={90} align="right">
            Monto
          </TableHeaderCell>
          <TableHeaderCell width={110}>ID operación</TableHeaderCell>
          <TableHeaderCell width={28} />
        </TableHeader>
        {visible.length === 0 ? (
          <EmptyState icon="credit-card" title="No hay pagos con estos filtros" description="Probá con otro período o pestaña." />
        ) : (
          <TableBody>
            {visible.map((payment) => {
              const s = status(payment);
              const method = methods[payment.method];
              return (
                <TableRow key={payment.id}>
                  <TableCell width={80} primary={relativeDay(payment.at)} secondary={time(payment.at)} />
                  <TableCell width={150} weight="semibold">
                    {payment.memberName}
                  </TableCell>
                  <TableCell grow primary={payment.title} secondary={payment.detail} />
                  <TableCell width={170}>
                    <span className="flex items-center gap-2 text-label font-medium text-ink">
                      {method.icon === "mp" ? <MercadoPagoMark /> : <Icon name={method.icon} size={18} className="text-ink-muted" />}
                      {method.label}
                    </span>
                  </TableCell>
                  <TableCell width={130}>
                    <Badge tone={s.tone}>{s.label}</Badge>
                  </TableCell>
                  <TableCell width={90} align="right">
                    <span className={cn("text-label font-bold", payment.amount < 0 ? "text-danger" : payment.status === "rechazado" ? "text-ink-muted" : "text-ink")}>
                      {formatMoney(payment.amount)}
                    </span>
                  </TableCell>
                  <TableCell width={110} tone="muted">
                    <span className="truncate text-caption font-medium text-ink-muted">
                      {payment.operationId ?? (payment.manual ? "Carga manual" : "—")}
                    </span>
                  </TableCell>
                  <TableCell width={28}>
                    <Menu
                      items={rowMenu(payment)}
                      trigger={(props) => (
                        <button
                          type="button"
                          aria-label={`Acciones del pago de ${payment.memberName}`}
                          {...props}
                          className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted hover:bg-blue-tint aria-expanded:bg-blue-tint"
                        >
                          <Icon name="dots" size={18} strokeWidth={3} />
                        </button>
                      )}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
      </Table>
    </>
  );
}

/** Small Mercado Pago badge (third-party brand color). */
function MercadoPagoMark() {
  return (
    <span aria-hidden className="flex size-[18px] shrink-0 items-center justify-center rounded-[4px] bg-mercado-pago">
      <svg width="12" height="8" viewBox="0 0 12 8" fill="none">
        <path d="M1 5.5c1.5-3 3-3 5 0s3.5 3 5 0" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    </span>
  );
}
