"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { runAction, type ActionResult } from "@/lib/auth/guard";

import { inviteInFirebase, renewInvite, setAccessInFirebase, staffEmail } from "./firebase";

const refresh = () => revalidatePath("/", "layout");

/*
 * The role is a custom claim and the profile, status and pending invitation live in Firestore
 * (./firebase.ts). Everyone invited is an admin: the single superadmin is set by
 * scripts/make-superadmin.ts. Invitations are a 7-day, single-use link the superadmin copies and
 * shares; no email is sent. `link` is null when the person already had an account.
 */

/** Origin for invitation links: the panel the superadmin is using. */
async function panelOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${host}`;
}

export async function inviteStaff(input: { name: string; email: string }): Promise<ActionResult<{ link: string | null }>> {
  return runAction("staff.gestionar", async (me) => {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 3) throw new Error("Escribí el nombre.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Revisá el correo.");
    const result = await inviteInFirebase({ name, email, role: "admin", invitedBy: me.name, origin: await panelOrigin() });
    refresh();
    return result;
  });
}

/** A new invitation link (the previous one stops working). */
export async function resendInvite(id: string): Promise<ActionResult<{ link: string | null }>> {
  return runAction("staff.gestionar", async (me) => {
    const result = await renewInvite(id, me.name, await panelOrigin());
    refresh();
    return result;
  });
}

/** Checks the person and returns their email; the browser asks Firebase to send the reset email. */
export async function sendPasswordReset(id: string): Promise<ActionResult<{ email: string }>> {
  return runAction("staff.gestionar", async () => ({ email: await staffEmail(id) }));
}

export async function setStaffAccess(input: { id: string; active: boolean }): Promise<ActionResult> {
  return runAction("staff.gestionar", async (me) => {
    if (input.id === me.id) throw new Error("No podés quitarte el acceso a vos mismo.");
    await setAccessInFirebase(input.id, input.active);
    refresh();
    return undefined;
  });
}
