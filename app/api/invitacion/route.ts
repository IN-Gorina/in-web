import { acceptInvite } from "@/lib/data/staff/firebase";
import { isFirebaseEnabled } from "@/lib/firebase/config";

/**
 * Accepting an invitation: the token from the link proves who it is for, so this sets that
 * user's password. The browser then signs in with it and opens the session as usual.
 */
export async function POST(request: Request) {
  if (!isFirebaseEnabled) return Response.json({ error: "Firebase no está configurado." }, { status: 404 });
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin") return Response.json({ error: "Pedido no permitido." }, { status: 403 });

  const body = (await request.json().catch(() => null)) as { token?: unknown; password?: unknown } | null;
  const token = typeof body?.token === "string" ? body.token : "";
  const password = typeof body?.password === "string" ? body.password : "";
  if (password.length < 8 || !/\d/.test(password)) return Response.json({ error: "Usá al menos 8 caracteres y un número." }, { status: 400 });

  try {
    const email = await acceptInvite(token, password);
    if (!email) return Response.json({ error: "La invitación venció o ya se usó. Pedile a un administrador una nueva." }, { status: 410 });
    return Response.json({ email });
  } catch {
    return Response.json({ error: "Algo salió mal. Probá de nuevo en un rato." }, { status: 500 });
  }
}
