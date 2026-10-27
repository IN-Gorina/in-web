"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import type { StaffRole } from "@/lib/auth/permissions";
import { nowIso } from "@/lib/dates";
import { isFirebaseEnabled } from "@/lib/firebase/config";

import { db, newId } from "../mock/store";
import { changeRoleInFirebase, inviteInFirebase, renewInvite, setAccessInFirebase, staffEmail } from "./firebase";

const refresh = () => revalidatePath("/", "layout");

/*
 * With Firebase, the role is a custom claim and the profile, status and pending invitation live
 * in Firestore (./firebase.ts). Invitations are a 7-day, single-use link the administrador
 * copies and shares; no email is sent. Without Firebase they update the mock store.
 * `link` is null when there is no link to share (mock mode, or the person already had an account).
 */

/** Origin for invitation links: the panel the administrador is using. */
async function panelOrigin(): Promise<string> {
  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  return `${requestHeaders.get("x-forwarded-proto") ?? "https"}://${host}`;
}

export async function inviteStaff(input: { name: string; email: string; role: StaffRole }): Promise<ActionResult<{ link: string | null }>> {
  return runAction("staff.gestionar", async (me) => {
    const name = input.name.trim();
    const email = input.email.trim().toLowerCase();
    if (name.length < 3) throw new Error("Escribí el nombre.");
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Revisá el correo.");
    if (isFirebaseEnabled) {
      const result = await inviteInFirebase({ name, email, role: input.role, invitedBy: me.name, origin: await panelOrigin() });
      refresh();
      return result;
    }
    const store = db();
    if (store.staff.some((s) => s.email === email)) throw new Error("Esa persona ya está en el equipo.");
    store.staff.push({ id: newId("staff"), name, email, role: input.role, status: "invitado", invitedAt: nowIso() });
    refresh();
    return { link: null };
  });
}

export async function changeStaffRole(input: { id: string; role: StaffRole }): Promise<ActionResult> {
  return runAction("staff.gestionar", async (me) => {
    if (input.id === me.id) throw new Error("No podés cambiar tu propio rol.");
    if (isFirebaseEnabled) {
      await changeRoleInFirebase(input.id, input.role);
      refresh();
      return undefined;
    }
    const store = db();
    const person = store.staff.find((s) => s.id === input.id);
    if (!person) throw new Error("No encontramos a esa persona.");
    if (person.role === "admin" && input.role !== "admin" && store.staff.filter((s) => s.role === "admin" && s.status === "activo").length <= 1)
      throw new Error("Tiene que quedar al menos un administrador.");
    person.role = input.role;
    refresh();
    return undefined;
  });
}

/** A new invitation link (the previous one stops working). */
export async function resendInvite(id: string): Promise<ActionResult<{ link: string | null }>> {
  return runAction("staff.gestionar", async (me) => {
    if (isFirebaseEnabled) {
      const result = await renewInvite(id, me.name, await panelOrigin());
      refresh();
      return result;
    }
    const person = db().staff.find((s) => s.id === id);
    if (!person || person.status !== "invitado") throw new Error("Esa invitación ya fue aceptada.");
    person.invitedAt = nowIso();
    refresh();
    return { link: null };
  });
}

/** Checks the person and returns their email; the browser asks Firebase to send the reset email. */
export async function sendPasswordReset(id: string): Promise<ActionResult<{ email: string }>> {
  return runAction("staff.gestionar", async () => {
    if (isFirebaseEnabled) return { email: await staffEmail(id) };
    const person = db().staff.find((s) => s.id === id);
    if (!person || person.status !== "activo") throw new Error("Esa persona no tiene acceso activo.");
    return { email: person.email };
  });
}

export async function setStaffAccess(input: { id: string; active: boolean }): Promise<ActionResult> {
  return runAction("staff.gestionar", async (me) => {
    if (input.id === me.id) throw new Error("No podés quitarte el acceso a vos mismo.");
    if (isFirebaseEnabled) {
      await setAccessInFirebase(input.id, input.active);
      refresh();
      return undefined;
    }
    const store = db();
    const person = store.staff.find((s) => s.id === input.id);
    if (!person) throw new Error("No encontramos a esa persona.");
    if (!input.active && person.role === "admin" && store.staff.filter((s) => s.role === "admin" && s.status === "activo").length <= 1)
      throw new Error("Tiene que quedar al menos un administrador.");
    person.status = input.active ? "activo" : "sin-acceso";
    refresh();
    return undefined;
  });
}
