import type { Metadata } from "next";
import { Suspense } from "react";

import { roleLabels } from "@/lib/auth/permissions";
import { findInvite } from "@/lib/data/staff/firebase";
import { listStaff } from "@/lib/data/staff/service";
import { addDays, dayKey, now, shortDate } from "@/lib/dates";
import { isFirebaseEnabled } from "@/lib/firebase/config";

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

const expiresLabel = (invitedAt: Date | string) => shortDate(`${addDays(dayKey(invitedAt), 7)}T12:00:00-03:00`).toLowerCase();

async function Invite({ searchParams }: Pick<PageProps<"/invitacion">, "searchParams">) {
  const { token } = await searchParams;
  if (isFirebaseEnabled) {
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

  const staff = await listStaff();
  // Mock mode: the token is the invited staff member's id; without one, show the first pending invite.
  const invited = staff.find((s) => s.status === "invitado" && (typeof token !== "string" || s.id === token));
  const admin = staff.find((s) => s.role === "admin");
  return (
    <AcceptInvite
      invite={
        invited
          ? {
              token: invited.id,
              email: invited.email,
              invitedBy: admin?.name ?? "El club",
              role: roleLabels[invited.role],
              expires: expiresLabel(invited.invitedAt ?? now()),
            }
          : null
      }
    />
  );
}
