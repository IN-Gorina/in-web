/*
 * Gives an account the Administrador role, for the first admin (nobody can invite before one
 * exists). Uses the same service account as the panel, from .env.local.
 *
 *   pnpm tsx scripts/make-admin.ts correo@club.com "Nombre Apellido"
 *
 * If the account doesn't exist yet it is created and the script prints a link to set its
 * password. Someone who signs in with Google can sign in once first (they'll see "Sin acceso"),
 * then run this.
 */

import { existsSync } from "node:fs";

import { applicationDefault, cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");

const [email, ...nameParts] = process.argv.slice(2);
if (!email || !email.includes("@")) {
  console.error('Uso: pnpm tsx scripts/make-admin.ts correo@club.com "Nombre Apellido"');
  process.exit(1);
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
const app = initializeApp({
  credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);

async function main() {
  const normalized = email.trim().toLowerCase();
  const existing = await auth.getUserByEmail(normalized).catch(() => null);
  const name = nameParts.join(" ").trim() || existing?.displayName || normalized.split("@")[0];
  const user = existing ?? (await auth.createUser({ email: normalized, displayName: name, emailVerified: true }));
  if (existing && !existing.displayName) await auth.updateUser(user.uid, { displayName: name });

  await auth.setCustomUserClaims(user.uid, { ...(user.customClaims ?? {}), role: "admin" });
  await getFirestore(app)
    .collection("staff")
    .doc(user.uid)
    .set({ name, email: normalized, role: "admin", status: "activo", invitedAt: new Date().toISOString(), invitedBy: "Configuración inicial" }, { merge: true });

  console.log(`✓ ${name} <${normalized}> es Administrador (uid ${user.uid}).`);
  if (!existing) {
    const link = await auth.generatePasswordResetLink(normalized);
    console.log(`Creá la contraseña con este link (vence en 1 hora):\n${link}`);
  } else {
    console.log("Si tenía la sesión abierta, que cierre sesión y vuelva a ingresar.");
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
