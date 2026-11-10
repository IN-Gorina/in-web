/*
 * Firebase Auth error codes → Spanish messages, the same ones the mobile app shows
 * (in-app/src/features/auth/validation.ts). With email enumeration protection on (Firebase's
 * default), a wrong email and a wrong password both arrive as invalid-credential.
 */

const messages = {
  invalidCredentials: "El correo o la contraseña no coinciden. Probá de nuevo o recuperala.",
  invalidEmail: "Revisá el correo: falta algo, como la @ o el dominio.",
  weakPassword: "Usá al menos 8 caracteres y un número.",
  accountExists: "Ese correo ya tiene una cuenta con otro método. Ingresá con tu correo y contraseña.",
  userDisabled: "Tu cuenta está suspendida. Escribile al club para revisarla.",
  tooManyRequests: "Hubo muchos intentos seguidos. Esperá unos minutos y probá de nuevo.",
  network: "No pudimos conectarnos. Revisá tu conexión y probá de nuevo.",
  popupBlocked: "El navegador bloqueó la ventana de Google. Permití las ventanas emergentes para este sitio y probá de nuevo.",
  unauthorizedDomain: "Este dominio no está autorizado para ingresar con Google. Avisale a un administrador.",
  providerDisabled: "Este método de ingreso no está habilitado. Avisale a un administrador.",
  unknown: "Algo salió mal. Probá de nuevo en un rato.",
};

const byCode: Record<string, string> = {
  "auth/invalid-credential": messages.invalidCredentials,
  "auth/invalid-login-credentials": messages.invalidCredentials,
  "auth/wrong-password": messages.invalidCredentials,
  "auth/user-not-found": messages.invalidCredentials,
  "auth/invalid-email": messages.invalidEmail,
  "auth/weak-password": messages.weakPassword,
  "auth/account-exists-with-different-credential": messages.accountExists,
  "auth/user-disabled": messages.userDisabled,
  "auth/too-many-requests": messages.tooManyRequests,
  "auth/network-request-failed": messages.network,
  "auth/popup-blocked": messages.popupBlocked,
  "auth/unauthorized-domain": messages.unauthorizedDomain,
  "auth/operation-not-allowed": messages.providerDisabled,
};

export function errorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error && typeof error.code === "string" ? error.code : undefined;
}

/** Closing the Google popup is not an error to show. */
export function isCancelled(error: unknown): boolean {
  const code = errorCode(error);
  return code === "auth/popup-closed-by-user" || code === "auth/cancelled-popup-request" || code === "auth/user-cancelled";
}

export function authMessage(error: unknown): string {
  if (error instanceof SessionError) return error.message;
  const message = byCode[errorCode(error) ?? ""];
  // The generic message hides the cause; keep it in the console so it can be diagnosed.
  if (!message) console.error("[auth] unexpected sign-in error", error);
  return message ?? messages.unknown;
}

/** The session route refused the sign-in; its message is already in Spanish. */
export class SessionError extends Error {}
