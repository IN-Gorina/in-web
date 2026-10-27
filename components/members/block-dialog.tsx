"use client";

import { useState, useTransition } from "react";

import { Callout } from "@/components/ui/callout";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field, TextArea } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { blockMember, unblockMember } from "@/lib/data/members/actions";

/** Paper "Panel / 14 – Bloquear socio". The reason is shown to the member. */
export function BlockMemberDialog({
  member,
  upcoming,
  onClose,
}: {
  member: { id: string; name: string };
  upcoming: number;
  onClose: () => void;
}) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  return (
    <ConfirmDialog
      open
      onClose={onClose}
      pending={pending}
      icon="ban"
      title={`¿Bloquear a ${member.name}?`}
      description={`No va a poder reservar, publicar ni sumarse a partidos.${upcoming ? ` ${upcoming === 1 ? "Su reserva futura se cancela" : `Sus ${upcoming} reservas futuras se cancelan`} y se devuelven las señas.` : ""}`}
      confirmLabel="Bloquear socio"
      onConfirm={() =>
        startTransition(async () => {
          const result = await blockMember({ id: member.id, reason });
          if (!result.ok) return setError(result.error);
          toast(result.data.cancelled ? `Socio bloqueado · ${result.data.cancelled} reservas canceladas` : "Socio bloqueado");
          onClose();
        })
      }
    >
      <Field label="Motivo" aside="Lo ve el socio">
        <TextArea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Ej: publicaste pedidos de pago por fuera del club. Podés escribirnos a recepción si querés revisarlo."
        />
      </Field>
      {error && <Callout tone="danger">{error}</Callout>}
    </ConfirmDialog>
  );
}

export function UnblockMemberDialog({ member, onClose }: { member: { id: string; name: string }; onClose: () => void }) {
  const toast = useToast();
  const [pending, startTransition] = useTransition();
  return (
    <ConfirmDialog
      open
      onClose={onClose}
      pending={pending}
      tone="primary"
      icon="send"
      title={`¿Desbloquear a ${member.name}?`}
      description="Vuelve a poder reservar, publicar y sumarse a partidos. Le avisamos por push."
      confirmLabel="Desbloquear"
      onConfirm={() =>
        startTransition(async () => {
          const result = await unblockMember(member.id);
          toast(result.ok ? "Socio desbloqueado" : result.error, result.ok ? "success" : "error");
          if (result.ok) onClose();
        })
      }
    />
  );
}
