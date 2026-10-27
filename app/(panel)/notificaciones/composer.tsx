"use client";

import { useRef, useState, useTransition } from "react";

import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle, Eyebrow } from "@/components/ui/card";
import { ChipGroup } from "@/components/ui/choice";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, TextArea, TextField, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Menu } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { useDismiss } from "@/components/ui/use-dismiss";
import { cn } from "@/lib/cn";
import { categoryName } from "@/lib/data/members/presentation";
import { cancelScheduled, sendNotification } from "@/lib/data/notifications/actions";
import { categories, type Category, type PushNotification } from "@/lib/data/types";
import { addDays, relativeDateTime, shortDay } from "@/lib/dates";
import { formatCount } from "@/lib/format";

type Audience = {
  todos: number;
  todosActivas: number;
  porCategoria: Record<string, number>;
  turnoFijo: number;
  temas: { id: string; label: string; size: number }[];
};

type Kind = "todos" | "categoria" | "tema" | "turno-fijo";

export function NotificationComposer({
  title: pageTitle,
  subtitle,
  sent,
  audience,
  targets,
  today,
  nowTime,
}: {
  title: string;
  subtitle: string;
  sent: PushNotification[];
  audience: Audience;
  targets: { value: string; label: string }[];
  today: string;
  nowTime: string;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<Kind>("todos");
  const [cats, setCats] = useState<Category[]>(["5ª", "6ª"]);
  const [topic, setTopic] = useState(audience.temas[0]!.id);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [target, setTarget] = useState<string>("inicio");
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recipients =
    kind === "todos"
      ? audience.todosActivas
      : kind === "categoria"
        ? cats.reduce((sum, c) => sum + (audience.porCategoria[c] ?? 0), 0)
        : kind === "tema"
          ? (audience.temas.find((t) => t.id === topic)?.size ?? 0)
          : audience.turnoFijo;
  const audienceLabel =
    kind === "todos"
      ? "Todos"
      : kind === "categoria"
        ? `Categorías ${cats.join(", ")}`
        : kind === "tema"
          ? `Siguen ${audience.temas.find((t) => t.id === topic)?.label.toLowerCase()}`
          : "Con turno fijo";

  const reset = () => {
    setTitle("");
    setBody("");
  };

  const send = (schedule?: { day: string; time: string }) =>
    startTransition(async () => {
      setError(null);
      const result = await sendNotification({ title, body, audienceLabel, recipients, schedule });
      if (!result.ok) {
        setConfirming(false);
        return setError(result.error);
      }
      toast(result.data.scheduled ? "Notificación programada" : `Enviada a ${formatCount(recipients)} socios`);
      setConfirming(false);
      reset();
    });

  return (
    <>
      <PageHeader
        title={pageTitle}
        subtitle={subtitle}
        actions={
          <Button icon="check" onClick={() => setConfirming(true)} disabled={!title.trim() || !body.trim()}>
            Enviar ahora
          </Button>
        }
      />

      <div className="flex min-h-0 flex-1 gap-5">
        <Card className="flex min-w-0 flex-1 flex-col gap-[18px] p-6">
          <CardTitle title="Nueva notificación" className="[&_h2]:text-title-2" />

          <Field label="¿A quién?">
            <ChipGroup
              label="¿A quién?"
              tone="blue"
              value={kind}
              onChange={setKind}
              options={[
                { value: "todos", label: `Todos los socios · ${formatCount(audience.todos)}` },
                { value: "categoria", label: "Por categoría" },
                { value: "tema", label: "Siguen un tema del portal" },
                { value: "turno-fijo", label: "Con turno fijo" },
              ]}
            />
          </Field>

          {kind === "categoria" ? (
            <CategoryChips
              value={cats}
              onChange={setCats}
              summary={`${cats.length ? "· " : ""}${formatCount(recipients)} socios con notificaciones activas`}
            />
          ) : (
            <>
              {kind === "tema" && (
                <ChipGroup label="Tema" value={topic} onChange={setTopic} options={audience.temas.map((t) => ({ value: t.id, label: t.label }))} />
              )}
              <p className="-mt-2 text-body-sm font-medium text-ink-muted">
                {formatCount(recipients)} socios con notificaciones activas
              </p>
            </>
          )}

          <TextField label="Título" aside={`${title.length} / 60`} maxLength={60} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ej: Americano de 5ª y 6ª este sábado" />
          <Field label="Mensaje" aside={`${body.length} / 140`}>
            <TextArea maxLength={140} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Lo que se lee en la notificación. Corto y con un dato concreto." />
          </Field>
          <Field label="Al tocarla abre">
            <Select variant="field" label="Al tocarla abre" value={target} onChange={setTarget} options={targets} width={420} />
          </Field>

          <div className="flex items-center gap-3">
            <SchedulePopover today={today} nowTime={nowTime} recipients={recipients} disabled={!title.trim() || !body.trim() || pending} onSchedule={send} />
            <span className="text-body-sm font-medium text-ink-muted">o enviala ahora con el botón de arriba</span>
          </div>
          {error && <Callout tone="danger">{error}</Callout>}
        </Card>

        <div className="flex w-[400px] shrink-0 flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-lg bg-elite-blue p-5">
            <p className="text-caption font-bold uppercase tracking-overline text-blue-tint">Vista previa en el teléfono</p>
            <div className="flex gap-3 rounded-md bg-white p-3.5">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-ink font-display text-caption text-energy-lime">IN</span>
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className={cn("text-body-sm font-bold", title ? "text-ink" : "text-ink-disabled")}>{title || "Título de la notificación"}</p>
                <p className={cn("line-clamp-3 text-caption font-medium", body ? "text-ink-muted" : "text-ink-disabled")}>
                  {body || "El mensaje aparece acá, como lo ve el socio."}
                </p>
              </div>
            </div>
          </div>

          <Card className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
            <Eyebrow>Enviadas</Eyebrow>
            {sent.map((n, index) => (
              <div key={n.id} className={cn("flex items-start justify-between gap-3 pb-3", index < sent.length - 1 && "border-b border-line")}>
                <div className="flex min-w-0 flex-col gap-0.5">
                  <p className="text-label font-bold text-ink">{n.title}</p>
                  <p className="text-caption font-medium text-ink-muted">
                    {n.status === "programada"
                      ? `Programada · ${relativeDateTime(n.at)}`
                      : n.status === "automatica"
                        ? `Automática · ${n.audienceLabel.toLowerCase()} · ${relativeDateTime(n.at).split(" · ")[0]!.toLowerCase()}`
                        : `${n.audienceLabel} · ${n.recipients ? `${formatCount(n.recipients)} recibieron` : ""}${n.openRate ? ` · ${n.openRate}% la abrió` : ""} · ${relativeDateTime(n.at).split(" · ")[0]!.toLowerCase()}`}
                  </p>
                </div>
                {n.status === "programada" && <CancelScheduled id={n.id} />}
              </div>
            ))}
          </Card>
        </div>
      </div>

      {confirming && (
        <ConfirmDialog
          open
          tone="primary"
          icon="send"
          onClose={() => setConfirming(false)}
          pending={pending}
          title={`¿Enviar a ${formatCount(recipients)} socios?`}
          description={`«${title}». Llega ahora y no se puede deshacer.`}
          confirmLabel="Enviar ahora"
          onConfirm={() => send()}
        />
      )}
    </>
  );
}

/** Chosen categories as removable chips ("5ª ✕"), a menu to add another and the audience size. */
function CategoryChips({ value, onChange, summary }: { value: Category[]; onChange: (value: Category[]) => void; summary: string }) {
  const remaining = categories.filter((c) => !value.includes(c));
  return (
    <div className="-mt-2 flex flex-wrap items-center gap-2">
      {value.map((c) => (
        <button
          key={c}
          type="button"
          aria-label={`Quitar ${c}`}
          onClick={() => onChange(value.filter((x) => x !== c))}
          className="inline-flex items-center gap-1 rounded-sm bg-field px-3 py-1.5 text-body-sm leading-4 font-bold text-ink hover:bg-blue-tint"
        >
          {c}
          <Icon name="x" size={11} strokeWidth={2.8} />
        </button>
      ))}
      {remaining.length > 0 && (
        <Menu
          placement="bottom-start"
          width={220}
          items={remaining.map((c) => ({
            label: `${c} · ${categoryName(c)}`,
            onSelect: () => onChange([...value, c]),
          }))}
          trigger={(props) => (
            <button
              type="button"
              {...props}
              className="inline-flex items-center gap-1 rounded-sm px-2 py-1.5 text-body-sm leading-4 font-bold text-link hover:bg-field"
            >
              <Icon name="plus" size={14} strokeWidth={2.6} />
              {value.length ? "Agregar" : "Elegir categoría"}
            </button>
          )}
        />
      )}
      <span className="py-1.5 text-body-sm leading-4 font-semibold text-ink-muted">{summary}</span>
    </div>
  );
}

function CancelScheduled({ id }: { id: string }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await cancelScheduled(id);
          toast(result.ok ? "Programación cancelada" : result.error, result.ok ? "success" : "error");
        })
      }
      className="shrink-0 text-caption font-bold text-danger hover:underline"
    >
      Cancelar
    </button>
  );
}

/** Paper "Panel / 11a – Programar notificación". */
function SchedulePopover({
  today,
  nowTime,
  recipients,
  disabled,
  onSchedule,
}: {
  today: string;
  nowTime: string;
  recipients: number;
  disabled: boolean;
  onSchedule: (schedule: { day: string; time: string }) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));
  const quick = [today, addDays(today, 1), addDays(today, 2)];
  const [day, setDay] = useState(quick[1]!);
  const [time, setTime] = useState("09:00");
  const [custom, setCustom] = useState(false);
  const label = (d: string) => (d === today ? "Hoy" : shortDay(`${d}T12:00:00-03:00`));
  const past = day === today && time <= nowTime;

  return (
    <div ref={ref} className="relative">
      <Button variant="secondary" size="lg" disabled={disabled} onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        Programar
      </Button>
      {open && (
        <div role="dialog" aria-label="Programar envío" className="absolute bottom-full left-0 z-30 mb-2 w-[380px] overflow-hidden rounded-lg border border-line bg-white shadow-menu">
          <div className="flex flex-col gap-4 px-5 py-[18px]">
            <p className="font-display text-title-card text-ink">Programar envío</p>
            <Field label="Día">
              <div className="flex gap-1.5">
                {quick.map((d) => (
                  <button
                    key={d}
                    type="button"
                    aria-pressed={!custom && day === d}
                    onClick={() => {
                      setCustom(false);
                      setDay(d);
                    }}
                    className={cn("h-[38px] flex-1 rounded-control text-body-sm font-bold", !custom && day === d ? "bg-elite-blue text-white" : "bg-field text-ink hover:bg-blue-tint")}
                  >
                    {label(d)}
                  </button>
                ))}
                <button
                  type="button"
                  aria-pressed={custom}
                  onClick={() => setCustom(true)}
                  className={cn("flex h-[38px] flex-1 items-center justify-center gap-1 rounded-control text-body-sm font-bold", custom ? "bg-elite-blue text-white" : "bg-field text-ink hover:bg-blue-tint")}
                >
                  <Icon name="calendar" size={14} />
                  Otro
                </button>
              </div>
              {custom && <TextInput type="date" aria-label="Otro día" min={today} value={day} onChange={(e) => setDay(e.target.value)} />}
            </Field>
            <div className="flex items-center justify-between">
              <div className="flex flex-col gap-0.5">
                <p className="text-body-sm font-bold text-ink">Hora</p>
                <p className="text-caption font-medium text-ink-muted">Hora de Argentina</p>
              </div>
              <TextInput type="time" aria-label="Hora" value={time} onChange={(e) => setTime(e.target.value)} className="w-[130px]" />
            </div>
            <Callout tone={past ? "warning" : "info"} icon="clock" className="py-2.5">
              {past ? "Ese horario ya pasó. Elegí uno más tarde." : `Sale el ${label(day).toLowerCase() === "hoy" ? "hoy" : label(day)} a las ${time} a ${formatCount(recipients)} socios`}
            </Callout>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-4 py-3">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button
              disabled={past}
              onClick={() => {
                setOpen(false);
                onSchedule({ day, time });
              }}
            >
              Programar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
