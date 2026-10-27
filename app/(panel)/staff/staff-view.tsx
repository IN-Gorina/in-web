"use client";

import { useState, useTransition } from "react";

import { Avatar, type AvatarTone } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle } from "@/components/ui/card";
import { ChoiceCard } from "@/components/ui/choice";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Field, TextInput } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { Menu, type MenuEntry } from "@/components/ui/menu";
import { PageHeader } from "@/components/ui/page-header";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { can, roleLabels, staffRoles, type Permission, type StaffRole } from "@/lib/auth/permissions";
import { changeStaffRole, inviteStaff, resendInvite, sendPasswordReset, setStaffAccess } from "@/lib/data/staff/actions";
import type { StaffMember } from "@/lib/data/types";
import { ago, relativeDateTime } from "@/lib/dates";
import { requestPasswordReset } from "@/lib/firebase/client";

const matrix: { label: string; permission: Permission }[] = [
  { label: "Ver agenda y reservas", permission: "agenda.ver" },
  { label: "Crear y cancelar reservas", permission: "reservas.gestionar" },
  { label: "Registrar cobro del saldo", permission: "cobros.registrar" },
  { label: "Aprobar turnos fijos", permission: "turnosFijos.aprobar" },
  { label: "Moderar el portal", permission: "portal.moderar" },
  { label: "Bloquear socios", permission: "socios.bloquear" },
  { label: "Enviar notificaciones", permission: "notificaciones.enviar" },
  { label: "Devolver señas", permission: "senas.devolver" },
  { label: "Canchas, tarifas y horarios", permission: "club.configurar" },
  { label: "Staff y permisos", permission: "staff.gestionar" },
];

const tones: AvatarTone[] = ["blue", "deep", "tint"];

export function StaffView({ title, subtitle, staff, meId }: { title: string; subtitle: string; staff: StaffMember[]; meId: string }) {
  const toast = useToast();
  const [, startTransition] = useTransition();
  const [inviting, setInviting] = useState(false);
  const [revoking, setRevoking] = useState<StaffMember | null>(null);
  const [shared, setShared] = useState<{ email: string; link: string } | null>(null);

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, message: string) =>
    startTransition(async () => {
      const result = await fn();
      toast(result.ok ? message : (result.error ?? "Algo salió mal"), result.ok ? "success" : "error");
    });

  const menu = (person: StaffMember): MenuEntry[] => {
    const items: MenuEntry[] = [
      { type: "header", label: <span className="text-micro font-bold uppercase tracking-eyebrow text-ink-muted">Rol</span> },
      ...staffRoles.map((role) => ({
        label: roleLabels[role],
        checked: person.role === role,
        onSelect: () => person.role !== role && run(() => changeStaffRole({ id: person.id, role }), `${person.name.split(" ")[0]} ahora es ${roleLabels[role]}`),
      })),
      { type: "separator" },
    ];
    if (person.status === "invitado")
      items.push({
        label: "Nuevo link de invitación",
        icon: "send",
        onSelect: () =>
          startTransition(async () => {
            const result = await resendInvite(person.id);
            if (!result.ok) return toast(result.error, "error");
            if (result.data.link) setShared({ email: person.email, link: result.data.link });
            else toast(`Invitación renovada para ${person.email}`);
          }),
      });
    if (person.status === "activo")
      items.push({
        label: "Restablecer contraseña",
        icon: "lock",
        onSelect: () =>
          run(async () => {
            const result = await sendPasswordReset(person.id);
            if (!result.ok) return result;
            try {
              await requestPasswordReset(result.data.email);
              return result;
            } catch {
              return { ok: false, error: "No pudimos mandar el correo. Probá de nuevo en un rato." };
            }
          }, `Le mandamos el link a ${person.email}`),
      });
    if (person.status === "sin-acceso")
      items.push({ label: "Devolver acceso", icon: "check", onSelect: () => run(() => setStaffAccess({ id: person.id, active: true }), "Acceso devuelto") });
    else items.push({ label: "Quitar acceso", icon: "ban", tone: "danger", onSelect: () => setRevoking(person) });
    return items;
  };

  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        actions={
          <Button icon="plus" onClick={() => setInviting(true)}>
            Invitar al staff
          </Button>
        }
      />
      <div className="flex min-h-0 flex-1 gap-5">
        <Card className="flex min-w-0 flex-1 flex-col gap-3 p-[22px]">
          <CardTitle title="Equipo" aside={`${staff.length} personas`} />
          <div className="flex flex-col">
            <div className="flex h-10 items-center gap-3 rounded-md bg-surface-muted px-3 text-caption font-bold uppercase tracking-label text-ink-muted">
              <span className="flex-1">Persona</span>
              <span className="w-[118px]">Rol</span>
              <span className="w-[96px]">Último uso</span>
              <span className="w-[92px]">Estado</span>
              <span className="w-7" />
            </div>
            {staff.map((person, index) => {
              const me = person.id === meId;
              return (
                <div key={person.id} className={cn("flex h-[68px] items-center gap-3 rounded-md px-3", me ? "bg-blue-tint" : "border-b border-line last:border-b-0")}>
                  <span className="flex min-w-0 flex-1 items-center gap-3">
                    <Avatar name={person.name} tone={person.status === "sin-acceso" ? "muted" : tones[index % tones.length]} size="lg" />
                    <span className="flex min-w-0 flex-col">
                      <span className={cn("truncate text-label font-bold", person.status === "sin-acceso" ? "text-ink-muted" : "text-ink")}>
                        {person.name}
                        {me && " (vos)"}
                      </span>
                      <span className="truncate text-caption font-medium text-ink-muted">{person.email}</span>
                    </span>
                  </span>
                  <span className="w-[118px]">
                    <Badge tone={person.role === "admin" ? "dark" : "info"}>{roleLabels[person.role]}</Badge>
                  </span>
                  <span className="w-[96px] text-body-sm font-semibold text-ink">
                    {person.status === "invitado" ? "—" : person.lastSeen ? (ago(person.lastSeen) === "Hoy" ? relativeDateTime(person.lastSeen).replace(" · ", " ") : ago(person.lastSeen)) : "—"}
                  </span>
                  <span className="w-[92px]">
                    {person.status === "activo" && <span className="text-body-sm font-bold text-success">Activo</span>}
                    {person.status === "invitado" && <Badge tone="warning">Pendiente</Badge>}
                    {person.status === "sin-acceso" && <span className="text-body-sm font-bold text-danger">Sin acceso</span>}
                  </span>
                  <span className="w-7">
                    {!me && (
                      <Menu
                        items={menu(person)}
                        trigger={(props) => (
                          <button
                            type="button"
                            aria-label={`Acciones de ${person.name}`}
                            {...props}
                            className="flex size-7 items-center justify-center rounded-[6px] text-ink-muted hover:bg-blue-tint aria-expanded:bg-blue-tint"
                          >
                            <Icon name="dots" size={18} strokeWidth={3} />
                          </button>
                        )}
                      />
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="mt-auto">
            <Callout tone="neutral" icon="info">
              Las invitaciones son un link que le compartís a esa persona y vencen a los 7 días. Quitar el acceso no borra lo que esa persona registró: las reservas y cobros
              quedan con su nombre.
            </Callout>
          </div>
        </Card>

        <Card className="flex w-[400px] shrink-0 flex-col gap-3 p-[22px]">
          <div className="flex flex-col gap-1">
            <CardTitle title="Permisos por rol" />
            <p className="text-body-sm font-medium text-ink-muted">Fijos en esta versión. Solo un administrador cambia roles.</p>
          </div>
          <div role="table" aria-label="Permisos por rol" className="flex flex-col">
            <div role="row" className="flex h-9 items-center rounded-md bg-surface-muted px-3 text-caption font-bold text-ink-muted">
              <span role="columnheader" className="flex-1 uppercase tracking-label">
                Puede
              </span>
              <span role="columnheader" className="w-[84px] text-center">
                Recepción
              </span>
              <span role="columnheader" className="w-[60px] text-center">
                Admin
              </span>
            </div>
            {matrix.map((row) => (
              <div key={row.permission} role="row" className="flex h-[46px] items-center border-b border-line px-3 last:border-b-0">
                <span role="cell" className="flex-1 text-body-sm font-semibold text-ink">
                  {row.label}
                </span>
                {(["recepcion", "admin"] as StaffRole[]).map((role) => (
                  <span key={role} role="cell" className={cn("flex justify-center", role === "recepcion" ? "w-[84px]" : "w-[60px]")}>
                    {can(role, row.permission) ? (
                      <Icon name="check" size={16} strokeWidth={2.6} className="text-success" label="Sí" />
                    ) : (
                      <span aria-label="No" className="h-px w-3 bg-ink-disabled" />
                    )}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </Card>
      </div>

      {inviting && (
        <InviteModal
          onClose={() => setInviting(false)}
          onLink={(email, link) => {
            setInviting(false);
            setShared({ email, link });
          }}
        />
      )}
      {shared && <InviteLinkModal email={shared.email} link={shared.link} onClose={() => setShared(null)} />}
      {revoking && (
        <ConfirmDialog
          open
          icon="ban"
          onClose={() => setRevoking(null)}
          title={`¿Quitarle el acceso a ${revoking.name}?`}
          description="No va a poder entrar al panel. Lo que registró (reservas, cobros) queda con su nombre. Podés devolverle el acceso después."
          confirmLabel="Quitar acceso"
          onConfirm={() => {
            const person = revoking;
            setRevoking(null);
            run(() => setStaffAccess({ id: person.id, active: false }), `${person.name.split(" ")[0]} ya no tiene acceso`);
          }}
        />
      )}
    </>
  );
}

/** Paper "Panel / 13a – Invitar al staff". */
function InviteModal({ onClose, onLink }: { onClose: () => void; onLink: (email: string, link: string) => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<StaffRole>("recepcion");

  const submit = () =>
    startTransition(async () => {
      setError(null);
      const result = await inviteStaff({ name, email, role });
      if (!result.ok) return setError(result.error);
      if (result.data.link) return onLink(email.trim(), result.data.link);
      // Mock mode, or the person already had an account (e.g. from the app): no link to share.
      toast(`${name.trim().split(" ")[0]} ya puede entrar al panel`);
      onClose();
    });

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title="Invitar al staff"
      subtitle="Te damos un link para que cree su contraseña"
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" size="lg" onClick={onClose}>
            Cancelar
          </Button>
          <Button size="lg" icon="send" onClick={submit} disabled={pending}>
            Crear invitación
          </Button>
        </>
      }
    >
      <div className="flex gap-3">
        <Field label="Nombre" className="flex-1">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre y apellido" />
        </Field>
        <Field label="Correo" className="flex-[1.4]">
          <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="nombre@ingorina.com.ar" />
        </Field>
      </div>
      <Field label="Rol">
        <div className="flex flex-col gap-2">
          <ChoiceCard
            indicator="radio"
            title="Recepción"
            description="Agenda, reservas, cobros, turnos fijos y moderación"
            selected={role === "recepcion"}
            onSelect={() => setRole("recepcion")}
          />
          <ChoiceCard
            indicator="radio"
            title="Administrador"
            description="Todo lo anterior, más tarifas, devoluciones, notificaciones y staff"
            selected={role === "admin"}
            onSelect={() => setRole("admin")}
          />
        </div>
      </Field>
      <Callout tone="neutral" icon="clock">
        El link vence en 7 días y sirve una sola vez. Si se vence, generá uno nuevo desde la lista.
      </Callout>
      {error && <Callout tone="danger">{error}</Callout>}
    </Modal>
  );
}

/** The invitation link to share (WhatsApp, email…). It is only shown here; the panel keeps a hash. */
function InviteLinkModal({ email, link, onClose }: { email: string; link: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = () =>
    navigator.clipboard.writeText(link).then(
      () => setCopied(true),
      () => setCopied(false),
    );

  return (
    <Modal
      open
      onClose={onClose}
      width={520}
      title="Invitación lista"
      subtitle={`Mandale este link a ${email} para que cree su contraseña`}
      footer={
        <>
          <span className="flex-1" />
          <Button variant="ghost" size="lg" onClick={onClose}>
            Listo
          </Button>
          <Button size="lg" icon={copied ? "check" : "send"} onClick={copy}>
            {copied ? "Link copiado" : "Copiar link"}
          </Button>
        </>
      }
    >
      <Field label="Link de invitación">
        <TextInput value={link} readOnly onFocus={(e) => e.currentTarget.select()} />
      </Field>
      <Callout tone="neutral" icon="clock">
        Vence en 7 días y sirve una sola vez. Cuando lo cierres no lo vas a poder ver de nuevo: si hace falta, generá uno nuevo desde la lista.
      </Callout>
    </Modal>
  );
}
