"use client";

import Link from "next/link";
import { Fragment, useState, useTransition } from "react";

import { useBookingTools } from "@/components/bookings/booking-tools";
import { BlockMemberDialog, UnblockMemberDialog } from "@/components/members/block-dialog";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle } from "@/components/ui/card";
import { Segmented } from "@/components/ui/choice";
import { TextArea } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { EmptyState } from "@/components/ui/states";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { sexLabels } from "@/lib/data/events/audience";
import { saveInternalNote, updateMemberSex } from "@/lib/data/members/actions";
import { memberStatus, sideLabels } from "@/lib/data/members/presentation";
import type { Member, Sex } from "@/lib/data/types";
import { dayMonth, monthYear, relativeDateTime } from "@/lib/dates";
import { formatMoney } from "@/lib/format";

export type ProfileRow = {
  id: string;
  bookingId?: string;
  start: string;
  place: string;
  description: string;
  badge: { label: string; tone: BadgeTone };
  amount: number | null;
  future: boolean;
};

export function MemberProfile({ member, rows, canBlock }: { member: Member; rows: ProfileRow[]; canBlock: boolean }) {
  const { data, openNew, openDetail } = useBookingTools();
  const [tab, setTab] = useState<"proximas" | "pasadas">("proximas");
  const [blocking, setBlocking] = useState(false);
  const [unblocking, setUnblocking] = useState(false);
  const status = memberStatus(member);
  const blocked = member.status === "bloqueado";
  const upcoming = rows.filter((r) => r.future);
  const list = tab === "proximas" ? upcoming : rows.filter((r) => !r.future).reverse();

  return (
    <>
      <header className="flex shrink-0 flex-col gap-4">
        <Link href="/socios" className="inline-flex items-center gap-1.5 self-start text-body-sm font-semibold text-ink-muted hover:text-ink">
          <Icon name="chevron-left" size={14} strokeWidth={2.4} />
          Socios
        </Link>
        <div className="flex items-center gap-[18px]">
          <Avatar name={member.name} tone="blue" size="xl" />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex items-center gap-2.5">
              <h1 className="font-display text-display tracking-tight text-ink">{member.name}</h1>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
            <p className="text-label font-medium text-ink-muted">
              {[
                member.category,
                member.side ? sideLabels[member.side] : null,
                `socio desde ${monthYear(member.memberSince)}`,
                member.usesApp ? "usa la app" : "sin la app",
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
          </div>
          <div className="flex shrink-0 gap-2.5">
            {canBlock &&
              (blocked ? (
                <Button variant="secondary" size="lg" icon="send" onClick={() => setUnblocking(true)}>
                  Desbloquear
                </Button>
              ) : (
                <Button variant="secondary" size="lg" icon="ban" onClick={() => setBlocking(true)}>
                  Bloquear
                </Button>
              ))}
            {!blocked && (
              <Button size="lg" icon="plus" onClick={() => openNew({ memberId: member.id })}>
                Reservar para {member.name.split(" ")[0]}
              </Button>
            )}
          </div>
        </div>
      </header>

      {blocked && member.blocked && (
        <Callout tone="danger" title={`Bloqueado desde el ${dayMonth(`${member.blocked.at}T12:00:00-03:00`)}`}>
          Motivo que ve el socio: {member.blocked.reason}
        </Callout>
      )}

      <div className="flex min-h-0 flex-1 gap-5">
        <div className="flex min-w-0 flex-1 flex-col gap-5">
          <Card className="flex py-5">
            {[
              [String(member.matchesPlayed), "Partidos jugados"],
              [String(member.bookingsCount), "Reservas propias"],
              [String(member.cancellations), "Cancelaciones"],
              [formatMoney(member.paidThisYear), "Pagado en 2026"],
            ].map(([value, label], index) => (
              <div key={label} className={cn("flex flex-1 flex-col gap-1 px-6", index > 0 && "border-l border-line")}>
                <span className="font-display text-title-1 text-ink">{value}</span>
                <span className="text-body-sm font-semibold text-ink-muted">{label}</span>
              </div>
            ))}
          </Card>

          <Card className="flex flex-1 flex-col">
            <div className="flex items-center justify-between px-6 py-[18px]">
              <CardTitle title="Reservas y partidos" />
              <Segmented
                variant="field"
                size="sm"
                label="Período"
                value={tab}
                onChange={setTab}
                className="h-8"
                options={[
                  { value: "proximas", label: "Próximas" },
                  { value: "pasadas", label: "Pasadas" },
                ]}
              />
            </div>
            {list.length === 0 ? (
              <EmptyState
                icon="calendar"
                title={tab === "proximas" ? "No tiene reservas próximas" : "No hay reservas pasadas este mes"}
                action={
                  tab === "proximas" && !blocked ? (
                    <Button variant="secondary" icon="plus" onClick={() => openNew({ memberId: member.id })}>
                      Reservar para {member.name.split(" ")[0]}
                    </Button>
                  ) : undefined
                }
              />
            ) : (
              list.map((row) => {
                const booking = row.bookingId ? data.bookings.find((b) => b.id === row.bookingId) : undefined;
                const content = (
                  <>
                    <span className="flex w-[150px] shrink-0 flex-col">
                      <span className="text-label font-bold text-ink">{relativeDateTime(row.start)}</span>
                      <span className="text-caption font-medium text-ink-muted">{row.place}</span>
                    </span>
                    <span className="flex-1 truncate text-label font-medium text-ink">{row.description}</span>
                    <span className="flex w-[170px] shrink-0">
                      <Badge tone={row.badge.tone}>{row.badge.label}</Badge>
                    </span>
                    <span className="w-[90px] shrink-0 text-right text-label font-bold text-ink">
                      {row.amount === null ? "—" : formatMoney(row.amount)}
                    </span>
                  </>
                );
                return booking ? (
                  <button
                    key={row.id}
                    type="button"
                    onClick={() => openDetail(booking)}
                    className="flex h-[60px] items-center gap-4 border-t border-line px-6 text-left hover:bg-surface-muted"
                  >
                    {content}
                  </button>
                ) : (
                  <div key={row.id} className="flex h-[60px] items-center gap-4 border-t border-line px-6">
                    {content}
                  </div>
                );
              })
            )}
          </Card>
        </div>

        <div className="flex w-[340px] shrink-0 flex-col gap-5">
          <Card className="flex flex-col px-[22px] pb-2 pt-5">
            <CardTitle title="Datos" className="pb-2" />
            {[
              ["Teléfono", member.phone ?? "—"],
              ["Correo", member.email ?? "—"],
              ["DNI", member.dni ?? "—"],
              [
                "Categoría",
                member.category ? `${member.category} · ${member.categoryChosenBy === "club" ? "corregida por el club" : "elegida por el socio"}` : "Sin categoría",
              ],
              ["Notificaciones", member.notificationsOn ? "Activas" : "Apagadas"],
            ].map(([label, value], index) => (
              <Fragment key={label}>
                {index === 4 && <SexRow member={member} />}
                <div className="flex h-10 items-center justify-between gap-4 border-t border-line">
                  <span className="text-body-sm font-medium text-ink-muted">{label}</span>
                  <span
                    className={cn(
                      "truncate text-body-sm font-bold",
                      label === "Notificaciones" ? (member.notificationsOn ? "text-success" : "text-ink-muted") : "text-ink",
                    )}
                  >
                    {value}
                  </span>
                </div>
              </Fragment>
            ))}
          </Card>
          <InternalNote member={member} />
        </div>
      </div>

      {blocking && (
        <BlockMemberDialog member={member} upcoming={upcoming.filter((r) => r.bookingId).length} onClose={() => setBlocking(false)} />
      )}
      {unblocking && <UnblockMemberDialog member={member} onClose={() => setUnblocking(false)} />}
    </>
  );
}

/** For women's or men's events. The member sets it in the app; the club can set or fix it here. */
function SexRow({ member }: { member: Member }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const choose = (sex: Sex) =>
    startTransition(async () => {
      const result = await updateMemberSex({ id: member.id, sex });
      toast(result.ok ? `Sexo: ${sexLabels[sex].toLowerCase()}` : result.error, result.ok ? "success" : "error");
    });
  return (
    <div className="flex h-10 items-center justify-between gap-4 border-t border-line">
      <span className="text-body-sm font-medium text-ink-muted">Sexo</span>
      <span role="radiogroup" aria-label="Sexo" className="flex gap-1">
        {(Object.keys(sexLabels) as Sex[]).map((sex) => (
          <button
            key={sex}
            type="button"
            role="radio"
            aria-checked={member.sex === sex}
            disabled={pending}
            onClick={() => member.sex !== sex && choose(sex)}
            className={cn(
              "h-7 rounded-full px-2.5 text-caption font-bold transition-colors disabled:opacity-60",
              member.sex === sex ? "bg-elite-blue text-white" : "text-ink-muted hover:bg-field hover:text-ink",
            )}
          >
            {sexLabels[sex]}
          </button>
        ))}
      </span>
    </div>
  );
}

function InternalNote({ member }: { member: Member }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(member.internalNote?.text ?? "");

  const save = () =>
    startTransition(async () => {
      const result = await saveInternalNote({ id: member.id, text });
      toast(result.ok ? "Nota guardada" : result.error, result.ok ? "success" : "error");
      if (result.ok) setEditing(false);
    });

  return (
    <Card className="flex flex-col gap-2.5 px-[22px] py-5">
      <CardTitle title="Nota interna" aside="Solo staff" />
      {editing ? (
        <>
          <TextArea value={text} onChange={(e) => setText(e.target.value)} placeholder="Algo que el staff tenga que saber de este socio" autoFocus />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
            <Button onClick={save} disabled={pending}>
              Guardar
            </Button>
          </div>
        </>
      ) : member.internalNote ? (
        <>
          <button type="button" onClick={() => setEditing(true)} className="rounded-control bg-field px-3.5 py-3 text-left text-body-sm font-medium leading-[19px] text-ink hover:bg-blue-tint">
            {member.internalNote.text}
          </button>
          <p className="text-caption font-medium text-ink-muted">
            {member.internalNote.by} · {dayMonth(`${member.internalNote.at}T12:00:00-03:00`)}
          </p>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="self-start text-body-sm font-bold text-link hover:underline">
          + Agregar nota
        </button>
      )}
    </Card>
  );
}
