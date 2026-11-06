"use client";

import Image from "next/image";
import { createContext, useContext, useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import { MemberPicker, type MemberOption } from "@/components/members/member-picker";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Eyebrow } from "@/components/ui/card";
import { Segmented, Switch, TileGroup } from "@/components/ui/choice";
import { ConfirmDialog, Drawer, DrawerClose, Modal } from "@/components/ui/dialog";
import { Field, SearchInput, TextArea, TextField, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Select } from "@/components/ui/select";
import { EmptyState } from "@/components/ui/states";
import { Table, TableBody, TableCell, TableFooter, TableHeader, TableHeaderCell, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { cancelEvent, previewAudience, registerAttendee, saveEvent } from "@/lib/data/events/actions";
import { audienceLabel, sexLabels } from "@/lib/data/events/audience";
import { categories, type ClubEvent, type Court, type EventAudience } from "@/lib/data/types";
import { addDays, dayKey, hoursAgo, longDate, shortDate, time, toIso } from "@/lib/dates";
import { formatCount, formatMoney } from "@/lib/format";

type Context = {
  courts: Court[];
  members: MemberOption[];
  today: string;
  club: { address: string };
};
type Tab = "proximos" | "borradores" | "pasados";

const eventTypes = ["Americano", "Clínica", "Torneo", "Social"] as const;

const Ctx = createContext<{ openForm: (event?: ClubEvent) => void } | null>(null);

export function NewEventButton() {
  const ctx = useContext(Ctx);
  return (
    <Button icon="plus" onClick={() => ctx?.openForm()}>
      Nuevo evento
    </Button>
  );
}

function statusBadge(event: ClubEvent): { label: string; tone: BadgeTone } {
  switch (event.status) {
    case "publicado":
      return { label: "Publicado", tone: "success" };
    case "borrador":
      return { label: "Borrador", tone: "neutral" };
    case "cancelado":
      return { label: "Cancelado", tone: "danger" };
    case "pasado":
      return { label: "Terminado", tone: "neutral" };
  }
}

/** "Aviso enviado el …", "Aviso programado para el …", "Sin aviso". */
function notificationStatus(event: ClubEvent) {
  const notification = event.notification;
  if (!notification) return "Sin aviso";
  if (notification.sentAt) return `Aviso enviado el ${shortDate(notification.sentAt).toLowerCase()} a las ${time(notification.sentAt)}`;
  if (!notification.at) return "El aviso sale al publicar";
  return `Aviso programado: ${shortDate(notification.at).toLowerCase()} a las ${time(notification.at)}`;
}

function whenLabel(event: ClubEvent) {
  if (!event.start) return `sin fecha · editado ${event.editedAt ? hoursAgo(event.editedAt) : ""}`.trim();
  return `${shortDate(event.start).toLowerCase()}, ${time(event.start)}`;
}

/** "Canchas 1 a 4", "Cancha 1 y Cancha 2", as the event shows in the panel and the app. */
function courtsLabel(courts: Court[]) {
  if (!courts.length) return null;
  if (courts.length > 2) return `Canchas ${courts[0]!.name.split(" ")[1]} a ${courts.at(-1)!.name.split(" ")[1]}`;
  return courts.map((c) => c.name).join(" y ");
}

export function EventsView({ events, context, children }: { events: ClubEvent[]; context: Context; children: ReactNode }) {
  const [tab, setTab] = useState<Tab>("proximos");
  const [query, setQuery] = useState("");
  const [type, setType] = useState<string | null>(null);
  const [form, setForm] = useState<{ event?: ClubEvent } | null>(null);
  const [detailId, setDetailId] = useState<string | null>(null);

  const isPast = (e: ClubEvent) => e.status === "pasado" || e.status === "cancelado" || (e.start ? dayKey(e.start) < context.today : false);
  const upcoming = events.filter((e) => e.status === "publicado" && !isPast(e));
  const drafts = events.filter((e) => e.status === "borrador");
  const past = events.filter((e) => e.status !== "borrador" && isPast(e));

  const list = useMemo(() => {
    const base = tab === "proximos" ? [...upcoming, ...drafts] : tab === "borradores" ? drafts : past;
    const q = query.trim().toLowerCase();
    return base.filter((e) => (!type || e.type === type) && (!q || e.title.toLowerCase().includes(q)));
  }, [tab, upcoming, drafts, past, query, type]);

  const detail = events.find((e) => e.id === detailId) ?? null;

  return (
    <Ctx.Provider value={{ openForm: (event) => setForm({ event }) }}>
      {children}
      <div className="flex shrink-0 items-center gap-2.5">
        <Segmented
          label="Eventos"
          value={tab}
          onChange={setTab}
          options={[
            { value: "proximos", label: "Próximos", count: upcoming.length },
            { value: "borradores", label: "Borradores", count: drafts.length },
            { value: "pasados", label: "Pasados" },
          ]}
        />
        <SearchInput placeholder="Buscar evento" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Buscar evento" className="w-[280px]" />
        <Select label="Todos los tipos" value={type} onChange={(v) => setType(v === type ? null : v)} options={eventTypes.map((t) => ({ value: t, label: t }))} width={200} />
      </div>

      <Table label="Eventos" className="flex-1">
        <TableHeader>
          <TableHeaderCell grow>Evento</TableHeaderCell>
          <TableHeaderCell width={130}>Estado</TableHeaderCell>
          <TableHeaderCell width={90} align="right">
            Anotados
          </TableHeaderCell>
        </TableHeader>
        {list.length === 0 ? (
          <EmptyState icon="calendar-star" title="No hay eventos acá" description="Creá uno con «Nuevo evento»: aparece en Social › Eventos de la app." />
        ) : (
          <TableBody>
            {list.map((event) => {
              const status = statusBadge(event);
              return (
                <TableRow key={event.id} height={84} onClick={() => (event.status === "borrador" ? setForm({ event }) : setDetailId(event.id))}>
                  <TableCell grow>
                    <span className="flex min-w-0 items-center gap-4">
                      <EventThumb event={event} />
                      <span className="flex min-w-0 flex-col gap-1">
                        <span className="truncate text-body font-semibold text-ink">{event.title}</span>
                        <span className="truncate text-body-sm font-medium text-ink-muted">
                          {event.type} · {whenLabel(event)} · para {audienceLabel(event.audience)}
                        </span>
                      </span>
                    </span>
                  </TableCell>
                  <TableCell width={130}>
                    <Badge tone={status.tone}>{status.label}</Badge>
                  </TableCell>
                  <TableCell width={90} align="right">
                    {event.status === "borrador" ? (
                      <span className="text-label text-ink-disabled">—</span>
                    ) : (
                      <span className="text-label font-bold text-ink">
                        {event.registered} / {event.capacity}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        )}
        <TableFooter>
          <span>
            {upcoming.length} {upcoming.length === 1 ? "próximo" : "próximos"} y {drafts.length} {drafts.length === 1 ? "borrador" : "borradores"}
          </span>
          {tab !== "pasados" && past.length > 0 && (
            <button type="button" onClick={() => setTab("pasados")} className="inline-flex items-center gap-1 font-bold text-link">
              Ver pasados <Icon name="chevron-down" size={14} strokeWidth={2.5} />
            </button>
          )}
        </TableFooter>
      </Table>

      {form && <EventFormModal event={form.event} context={context} onClose={() => setForm(null)} />}
      <EventDrawer event={detail} context={context} onClose={() => setDetailId(null)} onEdit={(event) => {
        setDetailId(null);
        setForm({ event });
      }} />
    </Ctx.Provider>
  );
}

function EventThumb({ event, className }: { event: ClubEvent; className?: string }) {
  return event.image ? (
    <Image
      src={event.image}
      alt=""
      width={72}
      height={52}
      unoptimized={event.image.startsWith("data:")}
      className={cn("h-[52px] w-[72px] shrink-0 rounded-sm object-cover", className)}
    />
  ) : (
    <span className={cn("flex h-[52px] w-[72px] shrink-0 items-center justify-center rounded-sm bg-deep-blue text-white/70", className)}>
      <Icon name="layout-grid" size={24} strokeWidth={1.6} />
    </span>
  );
}

// ── Nuevo / editar evento (Paper "Panel / 08b") ───────────────────────

/** First sentence of the description: what the app shows in the list and the notification's default text. */
const firstSentence = (text: string) => text.trim().split(/(?<=[.!?])\s/)[0] ?? "";

function EventFormModal({ event, context, onClose }: { event?: ClubEvent; context: Context; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState(event?.title ?? "");
  const [type, setType] = useState<string | null>(event?.type ?? null);
  const [capacity, setCapacity] = useState(event ? String(event.capacity) : "");
  const [day, setDay] = useState(event?.start ? dayKey(event.start) : "");
  const [from, setFrom] = useState(event?.start ? time(event.start) : "");
  const [to, setTo] = useState(event?.end ? time(event.end) : "");
  const [price, setPrice] = useState(event ? String(event.pricePerPerson) : "");
  const [courtIds, setCourtIds] = useState<string[]>(event?.courtIds ?? []);
  const [description, setDescription] = useState(event?.description ?? "");
  const [audience, setAudience] = useState<EventAudience>(event?.audience ?? { categories: null, sex: null });
  const sent = event?.notification?.sentAt ?? null;
  const [notify, setNotify] = useState(event ? event.notification !== null : true);
  // Until edited, the notification follows the event's title and first sentence.
  const [notifyTitle, setNotifyTitle] = useState<string | null>(event?.notification?.title ?? null);
  const [notifyBody, setNotifyBody] = useState<string | null>(event?.notification?.body ?? null);
  const [when, setWhen] = useState<"publicar" | "programar">(
    event?.notification?.at && !sent && new Date(event.notification.at) > new Date() ? "programar" : "publicar",
  );
  // By default, tomorrow at 9 (today at 9 has usually passed already).
  const [scheduleDay, setScheduleDay] = useState(event?.notification?.at ? dayKey(event.notification.at) : addDays(context.today, 1));
  const [scheduleTime, setScheduleTime] = useState(event?.notification?.at ? time(event.notification.at) : "09:00");
  const [previewing, setPreviewing] = useState(false);
  const dirty = title !== (event?.title ?? "") || description !== (event?.description ?? "");
  const published = event?.status === "publicado";

  const shownTitle = (notifyTitle ?? title).slice(0, 60);
  const shownBody = (notifyBody ?? firstSentence(description)).slice(0, 140);
  const reach = useAudienceSize(audience);
  // Checked as you type, next to each field (the server checks the same).
  const [tried, setTried] = useState(false);
  const scheduleIssue = notify && !sent && when === "programar" ? scheduleError(scheduleDay, scheduleTime, day && to ? toIso(day, to) : null) : null;
  const whenIssue = timeError(day, from, to, published || tried);

  const submit = (publish: boolean) => {
    setError(null);
    setTried(true);
    const issue = timeError(day, from, to, true) ?? scheduleIssue;
    if (issue) {
      toast(issue, "error");
      return;
    }
    startTransition(async () => {
      const result = await saveEvent({
        id: event?.id,
        title,
        type: type ?? "",
        capacity: Number(capacity),
        day,
        from,
        to,
        pricePerPerson: Number(price.replace(/\D/g, "") || 0),
        courtIds,
        description,
        audience,
        notification: notify && !sent ? { title: shownTitle, body: shownBody, schedule: when === "programar" ? { day: scheduleDay, time: scheduleTime } : null } : null,
        publish,
      });
      if (!result.ok) {
        toast(result.error, "error");
        return setError(result.error);
      }
      const sentAt = result.data.notification;
      toast(
        !publish
          ? "Borrador guardado"
          : !sentAt
            ? published ? "Cambios guardados" : "Evento publicado"
            : new Date(sentAt.at).getTime() - Date.now() < 120_000
              ? `${published ? "Cambios guardados" : "Evento publicado"} · el aviso sale en un minuto a ${formatCount(sentAt.withPush)} socios`
              : `${published ? "Cambios guardados" : "Evento publicado"} · aviso programado para el ${shortDate(sentAt.at).toLowerCase()} a las ${time(sentAt.at)}`,
      );
      onClose();
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      width={760}
      title={event ? "Editar evento" : "Nuevo evento"}
      headerAside={
        <button
          type="button"
          onClick={() => setPreviewing((v) => !v)}
          className="mr-1 inline-flex items-center gap-1.5 rounded-sm text-body-sm font-semibold text-elite-blue hover:underline"
        >
          <Icon name={previewing ? "chevron-left" : "eye"} size={16} />
          {previewing ? "Volver a editar" : "Vista previa"}
        </button>
      }
      footer={
        <>
            <span className="flex-1 text-body-sm font-medium text-ink-muted">{dirty ? "Sin guardar" : event?.editedAt ? `Guardado ${hoursAgo(event.editedAt)}` : ""}</span>
            {!published && (
              <Button variant="secondary" size="lg" onClick={() => submit(false)} disabled={pending}>
                Guardar borrador
              </Button>
            )}
            <Button size="lg" onClick={() => submit(true)} disabled={pending}>
              {published ? "Guardar cambios" : "Publicar"}
            </Button>
        </>
      }
    >
      {previewing ? (
        <div className="flex flex-col gap-4">
          <EventPreview
            context={context}
            draft={{
              title,
              type,
              description,
              start: day && from ? toIso(day, from) : undefined,
              from,
              to,
              price: Number(price.replace(/\D/g, "") || 0),
              courts: context.courts.filter((c) => courtIds.includes(c.id)),
              capacity: Number(capacity) || 0,
              registered: event?.registered ?? 0,
              audience: audienceLabel(audience),
            }}
          />
          {notify && <NotificationPreview title={shownTitle} body={shownBody} reach={reach} />}
        </div>
      ) : (
        <>
        <div className="flex flex-col gap-3">
          <TextField label="Título" placeholder="Ej: Americano femenino de los jueves" maxLength={80} value={title} onChange={(e) => setTitle(e.target.value)} />
          <div className="flex gap-3">
            <Field label="Tipo" className="flex-1">
              <Select variant="field" label="Tipo" placeholder="Elegir" value={type} onChange={setType} options={eventTypes.map((t) => ({ value: t, label: t }))} />
            </Field>
            <TextField label="Cupo" inputMode="numeric" placeholder="Ej: 24" value={capacity} onChange={(e) => setCapacity(e.target.value.replace(/\D/g, ""))} className="w-24 shrink-0" />
            <TextField label="Precio por persona" inputMode="numeric" placeholder="$ 0 = gratis" value={price} onChange={(e) => setPrice(e.target.value)} className="w-[160px] shrink-0" />
          </div>
        </div>
        <div className="flex gap-3">
          <TextField label="Fecha" type="date" min={context.today} value={day} onChange={(e) => setDay(e.target.value)} className="flex-1" invalid={Boolean(whenIssue) && !day} />
          <Field label="Horario" className="flex-1" error={whenIssue ?? undefined}>
            <div className="flex items-center gap-2">
              <TextInput aria-label="Hora de inicio" type="time" value={from} onChange={(e) => setFrom(e.target.value)} className="flex-1" />
              <span className="text-ink-muted">–</span>
              <TextInput aria-label="Hora de fin" type="time" value={to} onChange={(e) => setTo(e.target.value)} className="flex-1" />
            </div>
          </Field>
        </div>
        <Field label="Lugar">
          <div role="group" aria-label="Canchas" className="flex flex-wrap gap-2">
            {context.courts.map((court) => {
              const on = courtIds.includes(court.id);
              return (
                <button
                  key={court.id}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setCourtIds((ids) => (on ? ids.filter((id) => id !== court.id) : [...ids, court.id]))}
                  className={cn("h-8 rounded-full px-3 text-body-sm font-semibold", on ? "bg-elite-blue text-white" : "border border-line text-ink hover:bg-field")}
                >
                  {court.name}
                </button>
              );
            })}
          </div>
        </Field>
        <Field label="Descripción" aside={`${description.length} / 600`}>
          <TextArea
            maxLength={600}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Contá de qué se trata y qué incluye. La primera oración es la que se ve en la lista."
          />
        </Field>

        <AudienceFields audience={audience} onChange={setAudience} reach={reach} />

        <div className="flex flex-col gap-3 rounded-md border border-line p-4">
          <div className="flex items-center gap-3">
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <p className="text-label font-bold text-ink">Notificación</p>
              <p className="text-caption font-medium text-ink-muted">
                {sent
                  ? `Ya se envió el ${shortDate(sent).toLowerCase()} a las ${time(sent)}.`
                  : `Push a los socios de «${audienceLabel(audience)}» con notificaciones activas: ${reach ? formatCount(reach.withPush) : "…"}.`}
              </p>
            </div>
            {!sent && <Switch label="Avisar con una notificación" checked={notify} onChange={setNotify} />}
          </div>
          {notify && !sent && (
            <div className="flex gap-4">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <TextField
                  label="Título"
                  aside={`${shownTitle.length} / 60`}
                  maxLength={60}
                  placeholder="Título del evento"
                  value={shownTitle}
                  onChange={(e) => setNotifyTitle(e.target.value)}
                />
                <Field label="Mensaje" aside={`${shownBody.length} / 140`}>
                  <TextArea maxLength={140} rows={3} placeholder="Ej: Anotate desde la app, quedan pocos lugares." value={shownBody} onChange={(e) => setNotifyBody(e.target.value)} />
                </Field>
                <Field label="Cuándo sale" error={scheduleIssue ?? undefined}>
                  <Segmented
                    variant="field"
                    label="Cuándo sale"
                    value={when}
                    onChange={setWhen}
                    options={[
                      { value: "publicar", label: published ? "Al guardar" : "Al publicar" },
                      { value: "programar", label: "Programar" },
                    ]}
                  />
                  {when === "programar" && (
                    <div className="flex items-center gap-2">
                      <TextInput type="date" aria-label="Día del aviso" min={context.today} max={day || undefined} value={scheduleDay} onChange={(e) => setScheduleDay(e.target.value)} className="flex-1" />
                      <TextInput type="time" aria-label="Hora del aviso" value={scheduleTime} onChange={(e) => setScheduleTime(e.target.value)} className="w-[130px]" />
                    </div>
                  )}
                </Field>
              </div>
              <div className="w-[260px] shrink-0">
                <NotificationPreview title={shownTitle} body={shownBody} reach={reach} />
              </div>
            </div>
          )}
        </div>
        </>
      )}
      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}

/** The event's date and times: missing (only once the user tried to save), reversed or already past. */
function timeError(day: string, from: string, to: string, requireAll: boolean): string | null {
  if (!day || !from || !to) return requireAll ? "Elegí la fecha y las horas de inicio y fin." : null;
  if (to <= from) return "La hora de fin tiene que ser después de la de inicio.";
  if (new Date(toIso(day, to)) <= new Date()) return "Ese horario ya pasó.";
  return null;
}

function scheduleError(day: string, at: string, eventEnd: string | null): string | null {
  if (!day || !at) return "Elegí el día y la hora del aviso.";
  const when = new Date(toIso(day, at));
  if (when <= new Date()) return "Esa hora ya pasó: elegí una más tarde.";
  if (eventEnd && when >= new Date(eventEnd)) return "El aviso tiene que salir antes de que termine el evento.";
  return null;
}

type Reach = { members: number; withPush: number } | null;

/** Audience size for the chosen categories and sex, from the database (debounced). */
function useAudienceSize(audience: EventAudience): Reach {
  const [reach, setReach] = useState<Reach>(null);
  const key = `${audience.categories?.join() ?? "todas"}|${audience.sex ?? "todos"}`;
  useEffect(() => {
    if (audience.categories?.length === 0) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      const result = await previewAudience(audience);
      if (!cancelled && result.ok) setReach({ members: result.data.members, withPush: result.data.withPush });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `key` is the audience's value
  }, [key]);
  return audience.categories?.length === 0 ? { members: 0, withPush: 0 } : reach;
}

/** Who can sign up: categories (all or some) and sex. Everyone sees the event. */
function AudienceFields({ audience, onChange, reach }: { audience: EventAudience; onChange: (audience: EventAudience) => void; reach: Reach }) {
  const some = audience.categories !== null;
  return (
    <div className="flex flex-col gap-3 rounded-md border border-line p-4">
      <div className="flex flex-col gap-0.5">
        <p className="text-label font-bold text-ink">Quiénes pueden anotarse</p>
        <p className="text-caption font-medium text-ink-muted">
          Todos ven el evento en la app; solo «{audienceLabel(audience)}» puede anotarse
          {reach ? ` · ${formatCount(reach.members)} ${reach.members === 1 ? "socio" : "socios"}` : ""}.
        </p>
      </div>
      <div className="flex gap-3">
        <Field label="Categorías" className="flex-1">
          <Segmented
            variant="field"
            label="Categorías"
            value={some ? "elegir" : "todas"}
            onChange={(value) => onChange({ ...audience, categories: value === "todas" ? null : (audience.categories ?? []) })}
            options={[
              { value: "todas", label: "Todas" },
              { value: "elegir", label: "Elegir" },
            ]}
          />
        </Field>
        <Field label="Sexo" className="flex-1">
          <Segmented
            variant="field"
            label="Sexo"
            value={audience.sex ?? "todos"}
            onChange={(value) => onChange({ ...audience, sex: value === "todos" ? null : value })}
            options={[
              { value: "todos", label: "Todos" },
              { value: "femenino", label: sexLabels.femenino },
              { value: "masculino", label: sexLabels.masculino },
            ]}
          />
        </Field>
      </div>
      {some && (
        <TileGroup
          display
          label="Categorías que pueden anotarse"
          value={audience.categories ?? []}
          onChange={(category) => {
            const current = audience.categories ?? [];
            onChange({ ...audience, categories: current.includes(category) ? current.filter((c) => c !== category) : [...current, category] });
          }}
          options={categories.map((c) => ({ value: c, label: c }))}
        />
      )}
      {some && audience.categories?.length === 0 && <p className="text-caption font-semibold text-warning">Elegí al menos una categoría.</p>}
      {audience.sex && <p className="text-caption font-medium text-ink-muted">Los socios que no cargaron su sexo en la app no pueden anotarse: el club lo puede cargar en su ficha.</p>}
    </div>
  );
}

/** How the push looks on the phone, and who gets it. */
function NotificationPreview({ title, body, reach }: { title: string; body: string; reach: Reach }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg bg-elite-blue p-4">
      <p className="text-caption font-bold uppercase tracking-overline text-blue-tint">Vista previa en el teléfono</p>
      <div className="flex gap-3 rounded-md bg-white p-3.5">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-sm bg-ink font-display text-caption text-energy-lime">IN</span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className={cn("text-body-sm font-bold", title ? "text-ink" : "text-ink-disabled")}>{title || "Título de la notificación"}</p>
          <p className={cn("line-clamp-3 text-caption font-medium", body ? "text-ink-muted" : "text-ink-disabled")}>{body || "El mensaje aparece acá, como lo ve el socio."}</p>
        </div>
      </div>
      <p className="text-caption font-semibold text-blue-tint">
        {reach ? `Llega a ${formatCount(reach.withPush)} ${reach.withPush === 1 ? "socio" : "socios"} con notificaciones activas` : "Calculando a cuántos socios llega…"}
        {" · al tocarla abre el evento"}
      </p>
    </div>
  );
}

// ── Vista previa: how Social › Eventos shows it in the app (Paper "Social / 06" and "Social / 07") ──

type Draft = {
  title: string;
  type: string | null;
  description: string;
  start?: string;
  from: string;
  to: string;
  price: number;
  courts: Court[];
  capacity: number;
  registered: number;
  audience: string;
};

function spotsLabel(registered: number, capacity: number) {
  const left = Math.max(0, capacity - registered);
  const people = registered === 1 ? "1 anotado" : `${registered} anotados`;
  if (left === 0) return `${people} · sin lugares`;
  return `${people} · ${left === 1 ? "queda 1 lugar" : `quedan ${left} lugares`}`;
}

function EventPreview({ draft, context }: { draft: Draft; context: Context }) {
  const title = draft.title.trim() || "Título del evento";
  const dateLabel = draft.start ? `${shortDate(draft.start)} · ${draft.from}` : "Sin fecha";
  const summary = draft.description.trim().split(/(?<=[.!?])\s/)[0] || "La descripción aparece acá.";
  const price = draft.price ? `${formatMoney(draft.price)} por persona` : "Gratis";
  const place = courtsLabel(draft.courts) ?? "Sin canchas elegidas";

  const cover = (className: string) => (
    <span className={cn("flex items-center justify-center bg-elite-blue text-white/70", className)}>
      <Icon name="layout-grid" size={24} strokeWidth={1.6} />
    </span>
  );

  return (
    <div className="flex gap-6 rounded-lg bg-surface-muted p-5">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <Eyebrow>En la lista</Eyebrow>
        <div className="flex items-center gap-3.5 rounded-lg bg-white p-3 shadow-[0_1px_2px_rgb(1_3_48/6%),0_4px_16px_rgb(1_3_48/5%)]">
          {cover("size-[84px] shrink-0 rounded-md")}
          <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
            <span className="text-caption font-bold text-elite-blue">{dateLabel}</span>
            <span className="font-display text-[17px] leading-[22px] text-ink">{title}</span>
            <span className="line-clamp-2 text-body-sm font-medium text-ink-muted">{summary}</span>
          </div>
        </div>
        <p className="text-body-sm font-medium text-ink-muted">
          Así aparece en Social › Eventos, con la foto del club. Al tocarlo, el socio ve el detalle y se anota desde ahí si es de «{draft.audience}»; el resto lo ve sin poder anotarse.
        </p>
      </div>

      <div className="flex w-[300px] shrink-0 flex-col gap-3">
        <Eyebrow>Al abrirlo</Eyebrow>
        <div className="flex flex-col gap-3.5 rounded-lg bg-white p-4 shadow-[0_1px_2px_rgb(1_3_48/6%),0_4px_16px_rgb(1_3_48/5%)]">
          <div className="relative h-[140px] overflow-hidden rounded-[20px]">
            {cover("absolute inset-0 size-full")}
            {draft.type && (
              <span className="absolute left-3.5 top-3.5 flex h-[26px] items-center rounded-full bg-energy-lime px-2.5 text-micro font-bold uppercase tracking-[0.1em] text-ink">
                {draft.type}
              </span>
            )}
          </div>
          <h3 className="font-display text-title-2 text-ink">{title}</h3>
          <span className="self-start rounded-full bg-blue-tint px-2.5 py-1 text-caption font-bold text-elite-blue">Para {draft.audience}</span>
          <div className="flex flex-col gap-2.5">
            <PreviewRow icon="calendar" title={draft.start ? longDate(draft.start) : "Sin fecha"} detail={draft.from && draft.to ? `${draft.from} a ${draft.to}` : "Sin horario"} />
            <PreviewRow icon="map-pin" title={place} detail={context.club.address} />
            <PreviewRow icon="ticket" title={price} detail={draft.price ? "En el club o con Mercado Pago" : "Sin costo para socios"} />
          </div>
          <p className="border-t border-line pt-3 text-label font-semibold text-ink">
            {draft.capacity ? spotsLabel(draft.registered, draft.capacity) : "Sin cupo definido"}
          </p>
        </div>
      </div>
    </div>
  );
}

function PreviewRow({ icon, title, detail }: { icon: "calendar" | "map-pin" | "ticket"; title: string; detail: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="flex size-10 shrink-0 items-center justify-center rounded-control bg-blue-tint text-elite-blue">
        <Icon name={icon} size={20} strokeWidth={1.8} />
      </span>
      <span className="flex min-w-0 flex-col gap-px">
        <span className="truncate text-body font-semibold leading-5 text-ink">{title}</span>
        <span className="truncate text-body-sm font-medium text-ink-muted">{detail}</span>
      </span>
    </div>
  );
}

// ── Detalle (Paper "Panel / 08c") ─────────────────────────────────────

function EventDrawer({
  event,
  context,
  onClose,
  onEdit,
}: {
  event: ClubEvent | null;
  context: Context;
  onClose: () => void;
  onEdit: (event: ClubEvent) => void;
}) {
  return (
    <Drawer open={event !== null} onClose={onClose} width={520} label="Detalle de evento">
      {event && <EventDetail event={event} context={context} onClose={onClose} onEdit={onEdit} />}
    </Drawer>
  );
}

function EventDetail({ event, context, onClose, onEdit }: { event: ClubEvent; context: Context; onClose: () => void; onEdit: (event: ClubEvent) => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [cancelling, setCancelling] = useState(false);
  const [adding, setAdding] = useState(false);
  const [memberId, setMemberId] = useState<string | null>(null);
  const status = statusBadge(event);
  const paidOnline = event.attendees.filter((a) => a.paid === "mercado-pago").length;
  const payAtClub = event.attendees.filter((a) => a.paid === "en-club").length;
  const collected = (event.registered - payAtClub) * event.pricePerPerson;
  const courts = context.courts.filter((c) => event.courtIds.includes(c.id));
  const active = event.status === "publicado";

  const run = (fn: () => Promise<{ ok: boolean; error?: string; data?: unknown }>, ok: (data: unknown) => string) =>
    startTransition(async () => {
      const result = await fn();
      toast(result.ok ? ok(result.data) : (result.error ?? "Algo salió mal"), result.ok ? "success" : "error");
    });

  return (
    <>
      <div className="relative h-[150px] shrink-0 bg-deep-blue">
        {event.image && <Image src={event.image} alt="" fill sizes="520px" className="object-cover" unoptimized={event.image.startsWith("data:")} />}
        <div className="absolute right-5 top-5">
          <DrawerClose onClose={onClose} tone="white" />
        </div>
      </div>
      <header className="flex flex-col gap-2 border-b border-line px-7 pb-[18px] pt-5">
        <div className="flex items-center gap-2">
          <span className="text-micro font-bold uppercase tracking-eyebrow text-elite-blue">{event.type}</span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        <h2 className="font-display text-headline text-ink">{event.title}</h2>
        <div className="flex flex-wrap items-center gap-2">
          <Badge tone="info">Para {audienceLabel(event.audience)}</Badge>
          <span className="text-caption font-semibold text-ink-muted">{notificationStatus(event)}</span>
        </div>
        <p className="text-label font-semibold text-ink-muted">
          {[
            event.start ? `${shortDate(event.start)} · ${time(event.start)}${event.end ? ` a ${time(event.end)}` : ""}` : "Sin fecha",
            courtsLabel(courts),
            event.pricePerPerson ? `${formatMoney(event.pricePerPerson)} por persona` : "Gratis",
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-7 py-5">
        <div className="flex gap-6">
          <div className="flex flex-[1.4] flex-col gap-2">
            <span className="text-caption font-semibold text-ink-muted">Anotados</span>
            <span className="font-display text-[24px] leading-7 text-ink">
              {event.registered} / {event.capacity}
            </span>
            <span className="flex h-1.5 rounded-full bg-blue-tint">
              <span className="rounded-full bg-elite-blue" style={{ width: `${Math.min((event.registered / event.capacity) * 100, 100)}%` }} />
            </span>
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <span className="text-caption font-semibold text-ink-muted">Cobrado</span>
            <span className="font-display text-[24px] leading-7 text-ink">{formatMoney(collected)}</span>
            {payAtClub > 0 && <span className="text-caption font-semibold text-warning">{payAtClub} pagan en el club</span>}
          </div>
        </div>

        <div className="flex flex-col">
          <div className="flex items-center justify-between pb-1.5">
            <Eyebrow>Anotados</Eyebrow>
            {active && (
              <button type="button" onClick={() => setAdding((v) => !v)} className="text-body-sm font-bold text-link hover:underline">
                + Anotar socio
              </button>
            )}
          </div>
          {adding && (
            <div className="flex items-center gap-2 py-2">
              <div className="flex-1">
                <MemberPicker members={context.members} value={memberId} onChange={setMemberId} />
              </div>
              <Button
                disabled={!memberId || pending}
                onClick={() =>
                  memberId &&
                  run(
                    () => registerAttendee({ eventId: event.id, memberId }),
                    () => {
                      setAdding(false);
                      setMemberId(null);
                      return "Socio anotado · paga en el club";
                    },
                  )
                }
              >
                Anotar
              </Button>
            </div>
          )}
          {event.attendees.length === 0 ? (
            <p className="border-t border-line py-3 text-body-sm font-medium text-ink-muted">
              {event.registered ? `${event.registered} anotados desde la app.` : "Todavía no se anotó nadie."}
            </p>
          ) : (
            event.attendees.map((attendee) => (
              <div key={attendee.name} className="flex h-[52px] items-center gap-3 border-t border-line">
                <Avatar name={attendee.name} size="sm" />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-label font-bold text-ink">{attendee.name}</span>
                  <span className="truncate text-caption font-medium text-ink-muted">{attendee.detail}</span>
                </span>
                <Badge tone={attendee.paid === "mercado-pago" ? "success" : "warning"}>{attendee.paid === "mercado-pago" ? "Pagó · MP" : "Paga en el club"}</Badge>
              </div>
            ))
          )}
          {event.registered > event.attendees.length && event.attendees.length > 0 && (
            <p className="border-t border-line py-3 text-body-sm font-medium text-ink-muted">
              y {event.registered - event.attendees.length} más · {paidOnline} de esta lista pagaron por Mercado Pago
            </p>
          )}
        </div>
      </div>

      {active && (
        <footer className="flex flex-col gap-1 border-t border-line px-7 py-4">
          <Button size="lg" className="h-12 text-body" onClick={() => onEdit(event)}>
            Editar evento
          </Button>
          <button type="button" onClick={() => setCancelling(true)} className="h-10 text-label font-bold text-danger hover:underline">
            Cancelar evento
          </button>
        </footer>
      )}

      {cancelling && (
        <ConfirmDialog
          open
          onClose={() => setCancelling(false)}
          pending={pending}
          icon="calendar-star"
          title={`¿Cancelar «${event.title}»?`}
          description={`Deja de verse en la app${event.notification && !event.notification.sentAt ? " y no sale el aviso programado" : ""}. ${event.registered ? `Avisales a los ${event.registered} anotados: la app no les manda nada.` : ""}`.trim()}
          confirmLabel="Cancelar evento"
          onConfirm={() =>
            run(
              () => cancelEvent(event.id),
              () => {
                setCancelling(false);
                onClose();
                return "Evento cancelado";
              },
            )
          }
        />
      )}
    </>
  );
}
