"use client";

import Link from "next/link";
import { useState, useTransition, type ReactNode } from "react";

import { useBookingTools } from "@/components/bookings/booking-tools";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle } from "@/components/ui/card";
import { ChoiceCard, Segmented, Switch } from "@/components/ui/choice";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { removeCourt, saveCourt, saveRatesAndRules, setCourtEnabled } from "@/lib/data/club/actions";
import type { BookingRules, Court, CourtType, RateBand } from "@/lib/data/types";
import { dayKey, relativeDay, time } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

export function CourtsAndRates({
  title,
  subtitle,
  courts,
  rates: initialRates,
  rules: initialRules,
  nowIso,
}: {
  title: string;
  subtitle: string;
  courts: Court[];
  rates: RateBand[];
  rules: BookingRules;
  nowIso: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [rates, setRates] = useState(initialRates);
  const [rules, setRules] = useState(initialRules);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ court?: Court } | null>(null);
  const dirty = JSON.stringify(rates) !== JSON.stringify(initialRates) || JSON.stringify(rules) !== JSON.stringify(initialRules);

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveRatesAndRules({ rates, rules });
      if (!result.ok) return setError(result.error);
      toast("Tarifas y reglas guardadas · ya se ven en la app");
    });

  const setRate = (id: string, key: "weekday" | "saturday" | "sunday", value: string) =>
    setRates((current) => current.map((band) => (band.id === id ? { ...band, [key]: Number(value.replace(/\D/g, "")) } : band)));

  const down = (court: Court) => Boolean(court.maintenance && new Date(court.maintenance.until) > new Date(nowIso));
  const enabledCount = courts.filter((c) => c.enabled).length;
  const maintenanceCount = courts.filter(down).length;

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button icon="check" onClick={save} disabled={!dirty || pending}>
            Guardar cambios
          </Button>
        }
      />
      {error && <Callout tone="danger">{error}</Callout>}

      <div className="flex min-h-0 flex-1 gap-5">
        <Card className="flex w-[380px] shrink-0 flex-col p-5">
          <CardTitle
            title="Canchas"
            aside={`${enabledCount} canchas${maintenanceCount ? ` · ${maintenanceCount} en mantenimiento` : ""}`}
            className="border-b border-line pb-4"
          />
          <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
            {courts.map((court) => (
              <CourtRow key={court.id} court={court} down={down(court)} onEdit={() => setEditing({ court })} />
            ))}
          </div>
          <button
            type="button"
            onClick={() => setEditing({})}
            className="mt-3 flex h-11 shrink-0 items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-line bg-surface-muted text-body-sm font-semibold text-ink-muted hover:bg-field"
          >
            <Icon name="plus" size={16} />
            Agregar cancha
          </button>
        </Card>

        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Card className="flex flex-col gap-4 p-6">
            <div className="flex flex-col gap-1">
              <CardTitle title="Tarifas por franja" />
              <p className="text-body-sm font-medium text-ink-muted">Precio del turno completo de 90 min, igual para todas las canchas.</p>
            </div>
            <div role="table" aria-label="Tarifas" className="flex flex-col gap-2">
              <div role="row" className="flex gap-3 text-caption font-bold uppercase tracking-label text-ink-muted">
                <span className="w-[200px] shrink-0">Franja</span>
                <span className="flex-1">Lun a vie</span>
                <span className="flex-1">Sáb</span>
                <span className="flex-1">Domingo</span>
              </div>
              {rates.map((band) => (
                <div key={band.id} role="row" className="flex items-center gap-3">
                  <div className="flex w-[200px] shrink-0 flex-col">
                    <span className="flex items-center gap-2 text-label font-bold text-ink">
                      {band.label} · {band.kind}
                      {band.badge && <span className="rounded-full bg-energy-lime px-1.5 text-micro font-bold text-ink">{band.badge}</span>}
                    </span>
                    <span className="text-caption font-medium text-ink-muted">
                      {band.from} – {band.to}
                    </span>
                  </div>
                  {(["weekday", "saturday", "sunday"] as const).map((key) => (
                    <TextInput
                      key={key}
                      aria-label={`${band.label} · ${key === "weekday" ? "lunes a viernes" : key === "saturday" ? "sábado" : "domingo"}`}
                      inputMode="numeric"
                      value={band[key] ? band[key].toLocaleString("es-AR") : ""}
                      onChange={(e) => setRate(band.id, key, e.target.value)}
                      trailing={<span className="order-first text-body font-semibold text-ink-muted">$</span>}
                      className="flex-1 [&>input]:font-bold"
                    />
                  ))}
                </div>
              ))}
            </div>
            <Callout>Las franjas marcan valle y pico en la app. Los feriados usan la tarifa de su día: no hay franjas especiales.</Callout>
          </Card>

          <Card className="flex flex-col gap-4 p-6">
            <CardTitle title="Reglas de reserva" />
            <div className="grid grid-cols-2 gap-x-8">
              <RuleRow title="Duración del turno" hint="El socio elige al reservar">
                <Segmented
                  label="Duración por defecto"
                  value={String(rules.defaultDuration) as "60" | "90" | "120"}
                  onChange={(v) => setRules((r) => ({ ...r, defaultDuration: Number(v) as 60 | 90 | 120 }))}
                  options={[
                    { value: "60", label: "60" },
                    { value: "90", label: "90 min" },
                    { value: "120", label: "120" },
                  ]}
                />
              </RuleRow>
              <RuleRow title="Devolución de la seña" hint="Si cancela antes de">
                <Select
                  label="Devolución de la seña"
                  value={String(rules.refundHoursBefore)}
                  onChange={(v) => setRules((r) => ({ ...r, refundHoursBefore: Number(v) }))}
                  options={[6, 12, 24, 48].map((h) => ({ value: String(h), label: `${h} h antes` }))}
                  width={160}
                />
              </RuleRow>
              <RuleRow title="Anticipación máxima" hint="Días hacia adelante">
                <Select
                  label="Anticipación máxima"
                  value={String(rules.maxAdvanceDays)}
                  onChange={(v) => setRules((r) => ({ ...r, maxAdvanceDays: Number(v) }))}
                  options={[7, 14, 21, 30].map((d) => ({ value: String(d), label: `${d} días` }))}
                  width={160}
                />
              </RuleRow>
              <RuleRow title="Plazo para la seña" hint="Si no paga, el turno se libera">
                <Select
                  label="Plazo para la seña"
                  value={String(rules.depositMinutes)}
                  onChange={(v) => setRules((r) => ({ ...r, depositMinutes: Number(v) }))}
                  options={[5, 10, 15, 30].map((m) => ({ value: String(m), label: `${m} min` }))}
                  width={160}
                />
              </RuleRow>
              <RuleRow title="Horario del club" hint="Horario por día en Configuración" last>
                <Link href="/configuracion" className="text-body-sm font-bold text-link hover:underline">
                  Editar horario
                </Link>
              </RuleRow>
              <RuleRow title={`Seña fija · ${formatMoney(rules.depositAmount)}`} hint="Obligatoria, con Mercado Pago" last>
                <div className="flex items-center gap-3">
                  {rules.depositRequired && (
                    <TextInput
                      aria-label="Monto de la seña"
                      inputMode="numeric"
                      value={rules.depositAmount ? rules.depositAmount.toLocaleString("es-AR") : ""}
                      onChange={(e) => setRules((r) => ({ ...r, depositAmount: Number(e.target.value.replace(/\D/g, "")) }))}
                      trailing={<span className="order-first text-body font-semibold text-ink-muted">$</span>}
                      className="w-[120px]"
                    />
                  )}
                  <Switch label="Seña obligatoria" checked={rules.depositRequired} onChange={(v) => setRules((r) => ({ ...r, depositRequired: v }))} />
                </div>
              </RuleRow>
            </div>
          </Card>
        </div>
      </div>

      {editing && <CourtModal court={editing.court} onClose={() => setEditing(null)} defaultUntil={`${dayKey(nowIso)}T23:00`} />}
    </>
  );
}

function RuleRow({ title, hint, children, last }: { title: string; hint: string; children: ReactNode; last?: boolean }) {
  return (
    <div className={cn("flex min-h-[74px] items-center justify-between gap-4", !last && "border-b border-line")}>
      <div className="flex flex-col gap-0.5">
        <p className="text-label font-bold text-ink">{title}</p>
        <p className="text-caption font-medium text-ink-muted">{hint}</p>
      </div>
      {children}
    </div>
  );
}

function CourtRow({ court, down, onEdit }: { court: Court; down: boolean; onEdit: () => void }) {
  const { openBlock } = useBookingTools();
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const toggle = (enabled: boolean) =>
    startTransition(async () => {
      const result = await setCourtEnabled({ id: court.id, enabled });
      toast(result.ok ? (enabled ? `${court.name} habilitada` : `${court.name} deshabilitada · no se puede reservar`) : result.error, result.ok ? "success" : "error");
    });

  return (
    <div className="flex flex-col gap-2.5 border-b border-line py-4 last:border-b-0">
      <div className="flex items-center gap-3.5">
        <span className={cn("flex size-11 shrink-0 items-center justify-center rounded-control", court.enabled ? "bg-elite-blue text-white" : "bg-sky text-white")}>
          <Icon name="layout-grid" size={24} strokeWidth={1.6} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <button type="button" onClick={onEdit} className="text-left text-body font-bold text-ink hover:underline">
            {court.name}
          </button>
          <span className="text-body-sm font-medium text-ink-muted">
            {court.type === "techada" ? "Techada" : "Descubierta"} · {!court.enabled ? "deshabilitada" : down ? "mantenimiento" : "habilitada"}
          </span>
        </div>
        <Switch label={`${court.name} habilitada`} checked={court.enabled} onChange={toggle} disabled={pending} />
      </div>
      <div className="flex items-center justify-between pl-[58px]">
        {down && court.maintenance ? (
          <span className="text-body-sm font-semibold text-danger">
            Mantenimiento hasta {relativeDay(court.maintenance.until) === "Hoy" ? "las" : relativeDay(court.maintenance.until).toLowerCase()} {time(court.maintenance.until)}
          </span>
        ) : (
          <span className="text-body-sm font-medium text-ink-muted">{court.slotsPerDay} turnos por día</span>
        )}
        <button
          type="button"
          onClick={down ? onEdit : () => openBlock({ courtIds: [court.id] })}
          className="inline-flex items-center gap-1.5 text-body-sm font-bold text-link hover:underline"
        >
          <Icon name="lock" size={14} />
          {down ? "Editar" : "Bloquear horario"}
        </button>
      </div>
    </div>
  );
}

/** Paper "Panel / 10a – Editar cancha" (also used to add a court). */
function CourtModal({ court, onClose, defaultUntil }: { court?: Court; onClose: () => void; defaultUntil: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [name, setName] = useState(court?.name ?? "");
  const [type, setType] = useState<CourtType>(court?.type ?? "techada");
  const [maintenance, setMaintenance] = useState(Boolean(court?.maintenance));
  const [until, setUntil] = useState(court?.maintenance ? `${dayKey(court.maintenance.until)}T${time(court.maintenance.until)}` : defaultUntil);
  const [reason, setReason] = useState(court?.maintenance?.reason ?? "");

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveCourt({ id: court?.id, name, type, maintenance: maintenance ? { until, reason } : null });
      if (!result.ok) return setError(result.error);
      toast(court ? "Cancha actualizada" : "Cancha agregada");
      onClose();
    });

  return (
    <>
      <Modal
        open
        onClose={onClose}
        width={500}
        title={court?.name ?? "Agregar cancha"}
        subtitle={court ? "Nombre, tipo y estado de la cancha" : "Aparece en la agenda y en la app al guardar"}
        footer={
          <>
            <span className="flex-1">
              {court && (
                <button type="button" onClick={() => setRemoving(true)} className="text-label font-bold text-danger hover:underline">
                  Dar de baja
                </button>
              )}
            </span>
            <Button variant="ghost" size="lg" onClick={onClose}>
              Cancelar
            </Button>
            <Button size="lg" onClick={submit} disabled={pending}>
              Guardar
            </Button>
          </>
        }
      >
        <div className="flex gap-3">
          <Field label="Nombre" className="flex-1">
            <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Cancha 7" />
          </Field>
          <Field label="Tipo" className="w-[210px] shrink-0">
            <Segmented
              variant="field"
              label="Tipo"
              value={type}
              onChange={setType}
              options={[
                { value: "techada", label: "Techada" },
                { value: "descubierta", label: "Descubierta" },
              ]}
            />
          </Field>
        </div>
        <Field label="Estado">
          <div className="flex flex-col gap-2">
            <ChoiceCard indicator="radio" title="Habilitada" description="Se puede reservar desde la app" selected={!maintenance} onSelect={() => setMaintenance(false)} />
            <ChoiceCard
              indicator="radio"
              title="En mantenimiento"
              description="Se ve en la app como no disponible"
              selected={maintenance}
              onSelect={() => setMaintenance(true)}
            >
              {maintenance && (
                <div className="flex gap-2 pl-8">
                  <TextInput type="datetime-local" aria-label="Hasta" value={until} onChange={(e) => setUntil(e.target.value)} className="flex-1 bg-white" />
                  <TextInput aria-label="Motivo" placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} className="flex-1 bg-white" />
                </div>
              )}
            </ChoiceCard>
          </div>
        </Field>
        {court?.maintenance && !maintenance && <Badge tone="success">Al guardar vuelve a estar disponible en la app</Badge>}
        {error && <Callout tone="danger">{error}</Callout>}
      </Modal>
      {removing && court && (
        <ConfirmDialog
          open
          icon="layout-grid"
          onClose={() => setRemoving(false)}
          pending={pending}
          title={`¿Dar de baja ${court.name}?`}
          description="Deja de aparecer en la agenda y en la app. Solo se puede si no tiene reservas futuras."
          confirmLabel="Dar de baja"
          onConfirm={() =>
            startTransition(async () => {
              const result = await removeCourt(court.id);
              toast(result.ok ? `${court.name} dada de baja` : result.error, result.ok ? "success" : "error");
              setRemoving(false);
              if (result.ok) onClose();
            })
          }
        />
      )}
    </>
  );
}
