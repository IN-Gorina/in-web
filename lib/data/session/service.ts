import "server-only";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { cache } from "react";

import type { StaffRole } from "@/lib/auth/permissions";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE } from "@/lib/firebase/config";

import { roleOf } from "../staff/firebase";
import type { StaffMember } from "../types";

export type SignedInAccount = { uid: string; name: string; email: string; role: StaffRole | null };

/**
 * The account behind the session cookie, or null when there is none or it's no longer valid
 * (expired, signed out everywhere, password changed, user disabled). The role is read from the
 * user record on every request, so a role change or removed access applies right away.
 * cache(): one verification per request, however many components ask.
 *
 * Verifying compares expiry against the clock, so it waits for the actual request
 * (connection()). Every panel page renders behind its own <Suspense>, so this streams in.
 */
export const getSignedInAccount = cache(async (): Promise<SignedInAccount | null> => {
  const cookie = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!cookie) return null;
  await connection();
  try {
    const decoded = await adminAuth().verifySessionCookie(cookie);
    const user = await adminAuth().getUser(decoded.uid);
    // The same checks verifySessionCookie(cookie, true) runs, without fetching the user twice.
    const revokedAt = user.tokensValidAfterTime ? new Date(user.tokensValidAfterTime).getTime() : 0;
    if (user.disabled || decoded.auth_time * 1000 < revokedAt) return null;
    const email = user.email ?? "";
    return { uid: user.uid, name: user.displayName || email.split("@")[0], email, role: roleOf(user.customClaims) };
  } catch {
    return null;
  }
});

/**
 * The staff member using the panel. Every page and server action goes through here.
 * No session → /ingresar; signed in without a staff role (a member of the app) → /sin-acceso.
 */
export const getCurrentStaff = cache(async (): Promise<StaffMember> => {
  const account = await getSignedInAccount();
  if (!account) redirect("/ingresar");
  if (!account.role) redirect("/sin-acceso");
  return { id: account.uid, name: account.name, email: account.email, role: account.role, status: "activo" };
});
