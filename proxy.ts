import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/lib/firebase/config";

/**
 * Optimistic check only: without a session cookie, panel pages go straight to /ingresar instead
 * of flashing the panel. Whether the cookie is valid, and the role, is checked on the server by
 * getCurrentStaff() on every page and server action.
 */
export function proxy(request: NextRequest) {
  if (request.cookies.has(SESSION_COOKIE)) return NextResponse.next();
  const login = new URL("/ingresar", request.url);
  const { pathname, search } = request.nextUrl;
  if (pathname !== "/") login.searchParams.set("next", pathname + search);
  return NextResponse.redirect(login);
}

export const config = {
  // Everything except login screens, API routes, Next internals and public files.
  matcher: ["/((?!api|_next/static|_next/image|favicon\\.ico|brand/|events/|ingresar|recuperar|revisa-tu-correo|invitacion|sin-acceso).*)"],
};
