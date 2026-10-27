"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Segmented } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { SearchInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { endFixedSlot } from "@/lib/data/fixed-slots/actions";
import { weekdays, type Court, type FixedSlot, type FixedSlotStatus, type Weekday } from "@/lib/data/types";
import { monthYear, weekdayLabels } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

import { RequestCard } from "../fixed-slot-tools";

const thisWeekBadge: Record<NonNullable<FixedSlot["thisWeek"]>, { label: string; tone: BadgeTone }> = {
  reservado: { label: "Reservado", tone: "success" },
  liberado: { label: "Liberó esta semana", tone: "warning" },
  empieza: { label: "Empieza pronto", tone: "info" },
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function FixedSlotsTable({ slots, courts }: { slots: FixedSlot[]; courts: Court[] }) {
  const router = useRouter();
  const [status, setStatus] = useState<FixedSlotStatus>("activo");
  const [day, setDay] = useState<Weekday | null>(null);
  const [query, setQuery] = useState("");
  const [ending, setEnding] = useState<FixedSlot | null>(null);
  const courtName = (id: string | null) => courts.find((c) => c.id === id)?.name ?? "Cualquiera";

  const count = (s: FixedSlotStatus) => slots.filter((slot) => slot.status === s).length;
  const visible = useMemo(() => {
    const q = normalize(query.trim());
    return slots.filter(
      (slot) => slot.status === status && (!day || slot.weekday === day) && (!q || normalize(slot.holder.name).includes(q)),
    );
  }, [slots, status, day, query]);
  const weeklyIncome = slots.filter((s) => s.status === "activo").reduce((sum, s) => sum + s.price, 0);

  const menu = (slot: FixedSlot): MenuEntry[] => {
    const items: MenuEntry[] = [];
    if (slot.holder.memberId) items.push({ label: "Ver socio", icon: "user", onSelect: () => router.push(`/socios/${slot.holder.memberId}`) });
    if (slot.status === "activo") {
      items.push({ type: "separator" });
      items.push({ label: "Dar de baja", icon: "circle-x", tone: "danger", onSelect: () => setEnding(slot) });
    }
    return items.length ? items : [{ label: "Sin acciones", disabled: true, onSelect: () => {} }];
  };

  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center gap-2.5">
        <SearchInput className="w-[300px]" placeholder="Buscar por titular" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar turnos fijos" />
        <Segmented
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: "activo", label: "Activos", count: count("activo") },
            { value: "pedido", label: "Pedidos", count: count("pedido") },
            { value: "baja", label: "Dados de baja" },
          ]}
        />
        <Select
          label="Todos los días"
          value={day}
          onChange={(value) => setDay(value === day ? null : value)}
          options={weekdays.map((d) => ({ value: d, label: weekdayLabels[d].long }))}
          width={200}
        />
      </div>

      {status === "pedido" ? (
        visible.length === 0 ? (
          <EmptyState icon="repeat" title="No hay pedidos para revisar" />
        ) : (
          <div className="grid grid-cols-2 gap-4">
            {visible.map((slot) => (
              <RequestCard
                key={slot.id}
                slot={slot}
                description={`${weekdayLabels[slot.weekday].short} ${slot.time} · ${courtName(slot.courtId)} · ${slot.durationMin} min`}
                suggestedCourt={slot.availability?.suggestedCourtId ? courts.find((c) => c.id === slot.availability!.suggestedCourtId)?.shortName : undefined}
              />
            ))}
          </div>
        )
      ) : (
        <Table label="Turnos fijos" className="flex-1">
          <TableHeader>
            <TableHeaderCell width={240}>Titular</TableHeaderCell>
            <TableHeaderCell width={170}>Día y hora</TableHeaderCell>
            <TableHeaderCell width={100}>Cancha</TableHeaderCell>
            <TableHeaderCell width={170}>{status === "baja" ? "Motivo" : "Esta semana"}</TableHeaderCell>
            <TableHeaderCell grow>Desde</TableHeaderCell>
            <TableHeaderCell width={90} align="right">
              Tarifa
            </TableHeaderCell>
            <TableHeaderCell width={28} />
          </TableHeader>
          {visible.length === 0 ? (
            <EmptyState icon="repeat" title="No hay turnos fijos con estos filtros" />
          ) : (
            <TableBody>
              {visible.map((slot) => (
                <TableRow key={slot.id}>
                  <TableCell width={240}>
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={slot.holder.name} size="sm" />
                      <span className="flex min-w-0 flex-col">
                        <span className="truncate text-label font-bold text-ink">{slot.holder.name}</span>
                        {slot.holder.note && <span className="truncate text-caption font-medium text-ink-muted">{slot.holder.note}</span>}
                      </span>
                    </span>
                  </TableCell>
                  <TableCell width={170} weight="semibold">
                    {`${weekdayLabels[slot.weekday].long} ${slot.time} · ${slot.durationMin}′`}
                  </TableCell>
                  <TableCell width={100}>{courtName(slot.courtId)}</TableCell>
                  <TableCell width={170}>
                    {status === "baja" ? (
                      <span className="truncate text-body-sm font-medium text-ink-muted">{slot.rejection?.reason ?? "Dado de baja"}</span>
                    ) : slot.thisWeek ? (
                      <Badge tone={thisWeekBadge[slot.thisWeek].tone}>{thisWeekBadge[slot.thisWeek].label}</Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell grow tone="muted">
                    {monthYear(slot.since)}
                  </TableCell>
                  <TableCell width={90} align="right" weight="bold">
                    {formatMoney(slot.price)}
                  </TableCell>
                  <TableCell width={28}>
                    <Menu
                      items={menu(slot)}
                      trigger={(props) => (
                        <button
                          type="button"
                          aria-label={`Acciones del turno de ${slot.holder.name}`}
                          {...props}
                          className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted hover:bg-blue-tint aria-expanded:bg-blue-tint"
                        >
                          <Icon name="dots" size={18} strokeWidth={3} />
                        </button>
                      )}
                    />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
          {status === "activo" && (
            <TableFooter>
              <span>
                {visible.length} turnos fijos · ingresos fijos por semana {formatMoney(weeklyIncome)}
              </span>
            </TableFooter>
          )}
        </Table>
      )}

      {ending && <EndDialog slot={ending} courtName={courtName(ending.courtId)} onClose={() => setEnding(null)} />}
    </>
  );
}

function EndDialog({ slot, courtName, onClose }: { slot: FixedSlot; courtName: string; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      pending={pending}
      icon="repeat"
      title={`¿Dar de baja el turno de ${slot.holder.name}?`}
      description={`${weekdayLabels[slot.weekday].long} ${slot.time} · ${courtName}. Las próximas semanas quedan libres en la app y le avisamos por push.`}
      confirmLabel="Dar de baja"
      onConfirm={() =>
        startTransition(async () => {
          const result = await endFixedSlot(slot.id);
          toast(result.ok ? "Turno fijo dado de baja" : result.error, result.ok ? "success" : "error");
          if (result.ok) onClose();
        })
      }
    />
  );
}
