import type { Metadata } from "next";
import { Suspense } from "react";

import { roleLabels } from "@/lib/auth/permissions";
import { findInvite } from "@/lib/data/staff/firebase";
import { shortDate } from "@/lib/dates";

import { AcceptInvite, AuthHeader } from "../auth-form";

export const metadata: Metadata = { title: "Aceptar invitación" };

/** Link an administrador copies from Staff y permisos: /invitacion?token=… (valid 7 days, single use). */
export default function InvitacionPage({ searchParams }: PageProps<"/invitacion">) {
  return (
    <Suspense fallback={<AuthHeader title="Sumate al panel" subtitle="Cargando tu invitación…" />}>
      <Invite searchParams={searchParams} />
    </Suspense>
  );
}

async function Invite({ searchParams }: Pick<PageProps<"/invitacion">, "searchParams">) {
  const { token } = await searchParams;
  const invite = typeof token === "string" ? await findInvite(token) : null;
  return (
    <AcceptInvite
      invite={
        invite && typeof token === "string"
          ? {
              token,
              email: invite.email,
              invitedBy: invite.invitedBy,
              role: roleLabels[invite.role],
              // expiresAt is already 7 days after the invitation.
              expires: shortDate(invite.expiresAt).toLowerCase(),
            }
          : null
      }
    />
  );
}
