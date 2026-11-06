"use client";

import { getApps, initializeApp } from "firebase/app";
import {
  browserPopupRedirectResolver,
  GoogleAuthProvider,
  inMemoryPersistence,
  initializeAuth,
  sendPasswordResetEmail,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";

import { firebaseConfig } from "./config";
import { SessionError } from "./errors";

/*
 * Browser side of Firebase Auth. The browser only signs in to get an ID token; the session
 * itself is the httpOnly cookie set by /api/session, so auth state is kept in memory only.
 */

let auth: Auth | undefined;

export function firebaseAuth(): Auth {
  if (!auth) {
    const app = getApps()[0] ?? initializeApp(firebaseConfig);
    auth = initializeAuth(app, { persistence: inMemoryPersistence, popupRedirectResolver: browserPopupRedirectResolver });
    // Password reset emails and Firebase-hosted pages in Latin American Spanish, as in the app.
    auth.languageCode = "es-419";
  }
  return auth;
}

/** Exchanges the signed-in user's ID token for the session cookie. `staff` is false for members without a role. */
export async function startSession(user: User): Promise<{ staff: boolean }> {
  const response = await fetch("/api/session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ idToken: await user.getIdToken() }),
  });
  const body = (await response.json().catch(() => ({}))) as { staff?: boolean; error?: string };
  await signOut(firebaseAuth()).catch(() => {});
  if (!response.ok) throw new SessionError(body.error ?? "No pudimos iniciar la sesión. Probá de nuevo.");
  return { staff: body.staff === true };
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const { user } = await signInWithPopup(firebaseAuth(), provider);
  return user;
}

/** Clears the session cookie. */
export async function endSession(): Promise<void> {
  await signOut(firebaseAuth()).catch(() => {});
  await fetch("/api/session", { method: "DELETE" }).catch(() => {});
}

/** Firebase sends the email (Spanish template). The link comes back to the panel's login. */
export async function requestPasswordReset(email: string): Promise<void> {
  await sendPasswordResetEmail(firebaseAuth(), email, { url: `${window.location.origin}/ingresar` });
}
