"use client";

import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/choice";
import { Modal } from "@/components/ui/dialog";
import { Field, TextField, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { addClosedDay, removeClosedDay, saveClubSettings } from "@/lib/data/club/actions";
import { weekdays, type ClosedDay, type ClubSettings } from "@/lib/data/types";
import { addDays, dayMonth, shortDate, weekdayLabels } from "@/lib/dates";

export function SettingsForm({ title, subtitle, settings, today }: { title: string; subtitle: string; settings: ClubSettings; today: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(settings.name);
  const [phone, setPhone] = useState(settings.phone);
  const [address, setAddress] = useState(settings.address);
  const [openingDate, setOpeningDate] = useState(settings.openingDate);
  const [hours, setHours] = useState(settings.hours);
  const [addingDay, setAddingDay] = useState(false);

  const initial = JSON.stringify({ n: settings.name, p: settings.phone, a: settings.address, o: settings.openingDate, h: settings.hours });
  const dirty = JSON.stringify({ n: name, p: phone, a: address, o: openingDate, h: hours }) !== initial;

  const save = () =>
    startTransition(async () => {
      setError(null);
      const result = await saveClubSettings({ name, phone, address, openingDate, hours, categories: settings.categories });
      if (!result.ok) return setError(result.error);
      toast("Configuración guardada");
    });

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
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Card className="flex flex-col gap-4 p-[22px]">
            <CardTitle title="Datos del club" className="[&_h2]:text-title-2" />
            <div className="flex gap-3">
              <TextField label="Nombre" value={name} onChange={(e) => setName(e.target.value)} className="flex-1" />
              <TextField label="Teléfono de recepción" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="flex-1" />
            </div>
            <TextField label="Dirección" value={address} onChange={(e) => setAddress(e.target.value)} />
            <div className="flex items-center justify-between gap-4">
              <div className="flex flex-col gap-0.5">
                <p className="text-label font-bold text-ink">Apertura del club</p>
                <p className="text-body-sm font-medium text-ink-muted">Antes de esta fecha la app solo toma pre-inscripciones</p>
              </div>
              <TextInput type="date" aria-label="Apertura del club" value={openingDate} onChange={(e) => setOpeningDate(e.target.value)} className="w-[180px]" />
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-[22px]">
            <CardTitle
              title="Días cerrados"
              className="[&_h2]:text-title-2"
              aside={
                <button type="button" onClick={() => setAddingDay(true)} className="text-label font-bold text-link hover:underline">
                  + Agregar día
                </button>
              }
            />
            <p className="text-body-sm font-medium text-ink-muted">Esos días no se puede reservar. Las reservas existentes se avisan y se devuelve la seña.</p>
            <div className="flex flex-wrap gap-2">
              {settings.closedDays.length === 0 && <p className="text-body-sm font-medium text-ink-muted">No hay días cerrados cargados.</p>}
              {settings.closedDays.map((d) => (
                <ClosedDayChip key={d.id} day={d} />
              ))}
            </div>
          </Card>

          <Card className="flex flex-col gap-3 p-[22px]">
            <CardTitle title="Categorías del club" className="[&_h2]:text-title-2" />
            <p className="text-body-sm font-medium text-ink-muted">Cada socio elige la suya en la app. El club no la valida, pero puede corregirla desde Socios.</p>
            <div className="flex flex-wrap gap-2">
              {settings.categories.map((c) => (
                <span key={c} className="flex h-10 min-w-11 items-center justify-center rounded-control bg-field px-3 font-display text-body text-ink">
                  {c}
                </span>
              ))}
            </div>
          </Card>
        </div>

        <Card className="flex w-[440px] shrink-0 flex-col gap-1 p-[22px]">
          <CardTitle title="Horario de apertura" className="[&_h2]:text-title-2" />
          <p className="pb-3 text-body-sm font-medium text-ink-muted">Primer y último turno de cada día</p>
          {weekdays.map((day) => {
            const h = hours[day];
            return (
              <div key={day} className="flex h-[54px] items-center gap-3">
                <span className={cn("w-[96px] text-label font-bold", h.open ? "text-ink" : "text-ink-disabled")}>{weekdayLabels[day].long}</span>
                {h.open ? (
                  <>
                    <TextInput type="time" aria-label={`${weekdayLabels[day].long} abre`} value={h.from} onChange={(e) => setHours((cur) => ({ ...cur, [day]: { ...cur[day], from: e.target.value } }))} className="w-[100px] px-2.5" />
                    <span className="text-ink-muted">–</span>
                    <TextInput type="time" aria-label={`${weekdayLabels[day].long} cierra`} value={h.to} onChange={(e) => setHours((cur) => ({ ...cur, [day]: { ...cur[day], to: e.target.value } }))} className="w-[100px] px-2.5" />
                  </>
                ) : (
                  <span className="flex-1 text-body-sm font-semibold text-ink-muted">Cerrado</span>
                )}
                <span className="flex-1" />
                <Switch label={`${weekdayLabels[day].long} abierto`} checked={h.open} onChange={(open) => setHours((cur) => ({ ...cur, [day]: { ...cur[day], open } }))} />
              </div>
            );
          })}
          <p className="pt-3 text-caption font-medium text-ink-muted">Todo en hora de Argentina (UTC−3). Un cierre a las 00:00 o más temprano que la apertura es del día siguiente. Apagá un día para cerrarlo todas las semanas.</p>
        </Card>
      </div>

      {addingDay && <ClosedDayModal today={today} onClose={() => setAddingDay(false)} />}
    </>
  );
}

function ClosedDayChip({ day }: { day: ClosedDay }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const fromLabel = dayMonth(`${day.from}T12:00:00-03:00`);
  const toLabel = dayMonth(`${day.to}T12:00:00-03:00`);
  const sameMonth = day.from.slice(0, 7) === day.to.slice(0, 7);
  const label = day.from === day.to ? fromLabel : `${sameMonth ? fromLabel.split(" ")[0] : fromLabel} ${day.to > addDays(day.from, 1) ? "al" : "y"} ${toLabel}`;
  return (
    <span className={cn("inline-flex h-9 items-center gap-1.5 rounded-control bg-field pl-3 pr-1.5 text-body-sm font-bold text-ink", pending && "opacity-50")}>
      {label} · {day.reason}
      <button
        type="button"
        aria-label={`Quitar ${day.reason}`}
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await removeClosedDay(day.id);
            toast(result.ok ? `${day.reason}: el club abre de nuevo` : result.error, result.ok ? "success" : "error");
          })
        }
        className="flex size-6 items-center justify-center rounded-sm text-ink-muted hover:bg-blue-tint hover:text-ink"
      >
        <Icon name="x" size={14} strokeWidth={2.4} />
      </button>
    </span>
  );
}

/** Paper "Panel / 12a – Agregar día cerrado". */
function ClosedDayModal({ today, onClose }: { today: string; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [from, setFrom] = useState(addDays(today, 7));
  const [to, setTo] = useState(addDays(today, 7));
  const [reason, setReason] = useState("");
  const days = from && to && to >= from ? Math.round((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000) + 1 : 0;

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await addClosedDay({ from, to, reason });
      if (!result.ok) return setError(result.error);
      toast(result.data.cancelled ? `Día cerrado · ${result.data.cancelled} reservas canceladas y avisadas` : "Día cerrado agregado");
      onClose();
    });

  return (
    <Modal
      open
      onClose={onClose}
      width={500}
      title="Agregar día cerrado"
      subtitle="Esos días no se puede reservar en ninguna cancha"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" onClick={submit} disabled={pending || days === 0}>
            {days > 1 ? `Cerrar ${days} días` : "Cerrar el día"}
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <TextField
          label="Desde"
          type="date"
          min={today}
          value={from}
          onChange={(e) => {
            setFrom(e.target.value);
            if (e.target.value > to) setTo(e.target.value);
          }}
          className="flex-1"
        />
        <TextField label="Hasta" type="date" min={from} value={to} onChange={(e) => setTo(e.target.value)} className="flex-1" />
      </div>
      <Field label="Motivo" aside="Lo ven los socios en la app">
        <TextInput value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ej: Inmaculada Concepción" />
      </Field>
      <Callout tone="warning" title="Las reservas de esos días se cancelan">
        Les avisamos por push y les devolvemos la seña. {days > 0 && `Del ${shortDate(`${from}T12:00:00-03:00`)} al ${shortDate(`${to}T12:00:00-03:00`)}.`}
      </Callout>
      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}
