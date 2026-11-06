import "server-only";

import { createHash, randomBytes } from "node:crypto";

import { staffRoles, type StaffRole } from "@/lib/auth/permissions";
import { adminAuth, adminDb } from "@/lib/firebase/admin";

import type { StaffMember, StaffStatus } from "../types";

/*
 * Staff in Firebase. The role is a custom claim ({ staff_role }) and is what authorizes; the
 * Firestore `staff` collection (doc id = Firebase UID, Admin SDK only) holds the profile, the
 * status and the pending invitation, which Firebase Auth alone can't list.
 */

const INVITE_DAYS = 7;

type StaffDoc = {
  name: string;
  email: string;
  role: StaffRole;
  status: StaffStatus;
  invitedAt?: string;
  invitedBy?: string;
  lastSeen?: string;
  /** sha256 of the invitation token; the token itself only travels in the link. */
  inviteTokenHash?: string | null;
  inviteExpiresAt?: string | null;
};

const staffDocs = () => adminDb().collection("staff");

export function roleOf(claims: Record<string, unknown> | undefined): StaffRole | null {
  const role = claims?.staff_role;
  return staffRoles.find((r) => r === role) ?? null;
}

/** Sets or removes the role claim, keeping any other claims the user has (the app's, for one). */
async function setRoleClaim(uid: string, role: StaffRole | null) {
  const user = await adminAuth().getUser(uid);
  const claims = { ...user.customClaims };
  delete claims.staff_role;
  await adminAuth().setCustomUserClaims(uid, role ? { ...claims, staff_role: role } : claims);
}

const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

function newInvite() {
  const token = randomBytes(32).toString("base64url");
  const expires = new Date(Date.now() + INVITE_DAYS * 86_400_000).toISOString();
  return { token, fields: { inviteTokenHash: hashToken(token), inviteExpiresAt: expires } };
}

const inviteLink = (origin: string, token: string) => `${origin}/invitacion?token=${token}`;

// ── Reads ─────────────────────────────────────────────────────────────

export async function listStaffFromFirestore(): Promise<StaffMember[]> {
  const snapshot = await staffDocs().orderBy("name").get();
  return snapshot.docs.map((doc) => {
    const data = doc.data() as StaffDoc;
    return { id: doc.id, name: data.name, email: data.email, role: data.role, status: data.status, lastSeen: data.lastSeen, invitedAt: data.invitedAt };
  });
}

export type PendingInvite = { uid: string; email: string; role: StaffRole; invitedBy: string; expiresAt: string };

/** The invitation behind a token, or null if it doesn't exist, was used or expired. */
export async function findInvite(token: string): Promise<PendingInvite | null> {
  if (!token) return null;
  const snapshot = await staffDocs().where("inviteTokenHash", "==", hashToken(token)).limit(1).get();
  const doc = snapshot.docs[0];
  if (!doc) return null;
  const data = doc.data() as StaffDoc;
  if (data.status !== "invitado" || !data.inviteExpiresAt || new Date(data.inviteExpiresAt) < new Date()) return null;
  return { uid: doc.id, email: data.email, role: data.role, invitedBy: data.invitedBy ?? "El club", expiresAt: data.inviteExpiresAt };
}

// ── Session hooks ─────────────────────────────────────────────────────

/** Called when a staff member signs in: records the last use and closes a pending invite (e.g. accepted with Google). */
export async function markSignedIn(uid: string) {
  const ref = staffDocs().doc(uid);
  const snapshot = await ref.get();
  if (!snapshot.exists) return;
  const data = snapshot.data() as StaffDoc;
  await ref.update({
    lastSeen: new Date().toISOString(),
    ...(data.status === "invitado" ? { status: "activo", inviteTokenHash: null, inviteExpiresAt: null } : {}),
  });
}

/** Sets the password of an invited user and activates them. Returns the email to sign in with. */
export async function acceptInvite(token: string, password: string): Promise<string | null> {
  const invite = await findInvite(token);
  if (!invite) return null;
  await adminAuth().updateUser(invite.uid, { password, emailVerified: true });
  await staffDocs().doc(invite.uid).update({ status: "activo", inviteTokenHash: null, inviteExpiresAt: null });
  return invite.email;
}

// ── Staff management (callers check staff.gestionar) ──────────────────

async function getDoc(id: string): Promise<StaffDoc> {
  const snapshot = await staffDocs().doc(id).get();
  if (!snapshot.exists) throw new Error("No encontramos a esa persona.");
  return snapshot.data() as StaffDoc;
}

/** The superadmin is changed only with scripts/make-superadmin.ts. */
function assertNotSuperadmin(person: StaffDoc) {
  if (person.role === "superadmin") throw new Error("El superadministrador no se puede cambiar desde el panel.");
}

/**
 * Creates the Firebase user (no password) with the role, and returns the invitation link.
 * Someone who already has an account (e.g. a member of the app) gets the role right away and
 * signs in with what they already use; then there is no link.
 */
export async function inviteInFirebase(input: { name: string; email: string; role: StaffRole; invitedBy: string; origin: string }): Promise<{ link: string | null }> {
  const existing = await staffDocs().where("email", "==", input.email).limit(1).get();
  if (!existing.empty) throw new Error("Esa persona ya está en el equipo.");

  const user = await adminAuth()
    .getUserByEmail(input.email)
    .catch(() => null);
  const uid = user?.uid ?? (await adminAuth().createUser({ email: input.email, displayName: input.name })).uid;
  if (user && !user.displayName) await adminAuth().updateUser(uid, { displayName: input.name });
  await setRoleClaim(uid, input.role);

  const base: StaffDoc = { name: input.name, email: input.email, role: input.role, status: "activo", invitedAt: new Date().toISOString(), invitedBy: input.invitedBy };
  if (user) {
    await staffDocs().doc(uid).set(base);
    return { link: null };
  }
  const invite = newInvite();
  await staffDocs().doc(uid).set({ ...base, status: "invitado", ...invite.fields });
  return { link: inviteLink(input.origin, invite.token) };
}

/** New link for a pending invitation; the previous one stops working. */
export async function renewInvite(id: string, invitedBy: string, origin: string): Promise<{ link: string }> {
  const person = await getDoc(id);
  if (person.status !== "invitado") throw new Error("Esa invitación ya fue aceptada.");
  const invite = newInvite();
  await staffDocs().doc(id).update({ ...invite.fields, invitedAt: new Date().toISOString(), invitedBy });
  return { link: inviteLink(origin, invite.token) };
}

/**
 * Removing access drops the role claim (the next request lands on "Sin acceso") but doesn't
 * disable the Firebase user, so a staff member who is also a member keeps using the app.
 */
export async function setAccessInFirebase(id: string, active: boolean) {
  const person = await getDoc(id);
  assertNotSuperadmin(person);
  if (!active) {
    await setRoleClaim(id, null);
    await staffDocs().doc(id).update({ status: "sin-acceso", inviteTokenHash: null, inviteExpiresAt: null });
    return;
  }
  const user = await adminAuth().getUser(id);
  await setRoleClaim(id, person.role);
  // Someone who never finished the invitation goes back to pending; an admin copies a new link.
  await staffDocs().doc(id).update({ status: user.providerData.length > 0 ? "activo" : "invitado" });
}

export async function staffEmail(id: string): Promise<string> {
  const person = await getDoc(id);
  if (person.status !== "activo") throw new Error("Esa persona no tiene acceso activo.");
  return person.email;
}
