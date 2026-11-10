import { cookies } from "next/headers";

import { markSignedIn, roleOf } from "@/lib/data/staff/firebase";
import { adminAuth } from "@/lib/firebase/admin";
import { SESSION_COOKIE, SESSION_DAYS } from "@/lib/firebase/config";

/*
 * Session cookie (Firebase session cookies). The browser signs in with the JS SDK and posts the
 * ID token here; from then on the panel only trusts the httpOnly cookie, verified on the server.
 */

const MAX_SIGN_IN_AGE_S = 5 * 60;

/** Only the panel's own pages may call this (blocks login CSRF from other sites). */
const sameOrigin = (request: Request) => {
  const site = request.headers.get("sec-fetch-site");
  return !site || site === "same-origin";
};

const error = (message: string, status: number) => Response.json({ error: message }, { status });

export async function POST(request: Request) {
  if (!sameOrigin(request)) return error("Pedido no permitido.", 403);

  const body = (await request.json().catch(() => null)) as { idToken?: unknown } | null;
  if (typeof body?.idToken !== "string") return error("Falta el token.", 400);

  try {
    const decoded = await adminAuth().verifyIdToken(body.idToken, true);
    // Only a fresh sign-in can open a session, not an old token replayed later.
    if (Date.now() / 1000 - decoded.auth_time > MAX_SIGN_IN_AGE_S) return error("Volvé a ingresar.", 401);

    const expiresIn = SESSION_DAYS * 86_400_000;
    const sessionCookie = await adminAuth().createSessionCookie(body.idToken, { expiresIn });
    (await cookies()).set(SESSION_COOKIE, sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: expiresIn / 1000,
    });

    const staff = roleOf(decoded) !== null;
    if (staff) await markSignedIn(decoded.uid);
    return Response.json({ staff });
  } catch (cause) {
    console.error("[api/session] could not open the session", cause);
    return error("No pudimos iniciar la sesión. Probá de nuevo.", 401);
  }
}

/**
 * Sign out: clears the cookie. Refresh tokens are not revoked here, because that would also
 * sign the person out of the mobile app (same Firebase user).
 */
export async function DELETE(request: Request) {
  if (!sameOrigin(request)) return error("Pedido no permitido.", 403);
  (await cookies()).delete(SESSION_COOKIE);
  return new Response(null, { status: 204 });
}
