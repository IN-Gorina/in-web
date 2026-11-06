/*
 * Makes an account the club's superadministrador. There is only one: it can do everything,
 * including Staff y permisos, and nobody can change it from the panel. Uses the same service
 * account as the panel, from .env.local.
 *
 *   pnpm tsx scripts/make-superadmin.ts correo@club.com "Nombre Apellido"
 *   pnpm tsx scripts/make-superadmin.ts correo@club.com --transferir   (the current one becomes admin)
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

const args = process.argv.slice(2);
const transfer = args.includes("--transferir");
const [email, ...nameParts] = args.filter((arg) => arg !== "--transferir");
if (!email || !email.includes("@")) {
  console.error('Uso: pnpm tsx scripts/make-superadmin.ts correo@club.com "Nombre Apellido" [--transferir]');
  process.exit(1);
}

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
const app = initializeApp({
  credential: serviceAccount ? cert(JSON.parse(serviceAccount)) : applicationDefault(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
});
const auth = getAuth(app);
const staff = getFirestore(app).collection("staff");

/** Sets the staff role claim, keeping the app's claims (role: authenticated, app_user_id). */
async function setStaffRole(uid: string, role: "superadmin" | "admin") {
  const { customClaims } = await auth.getUser(uid);
  await auth.setCustomUserClaims(uid, { ...customClaims, staff_role: role });
}

async function main() {
  const normalized = email.trim().toLowerCase();
  const existing = await auth.getUserByEmail(normalized).catch(() => null);

  const current = (await staff.where("role", "==", "superadmin").get()).docs.filter((doc) => doc.id !== existing?.uid);
  if (current.length > 0 && !transfer) {
    const other = current[0].data() as { name: string; email: string };
    console.error(`Ya hay un superadministrador: ${other.name} <${other.email}>. Para reemplazarlo, sumá --transferir.`);
    process.exit(1);
  }

  const name = nameParts.join(" ").trim() || existing?.displayName || normalized.split("@")[0];
  const user = existing ?? (await auth.createUser({ email: normalized, displayName: name, emailVerified: true }));
  if (existing && !existing.displayName) await auth.updateUser(user.uid, { displayName: name });

  for (const doc of current) {
    await setStaffRole(doc.id, "admin");
    await doc.ref.update({ role: "admin" });
    console.log(`${(doc.data() as { name: string }).name} pasa a Administrador.`);
  }
  await setStaffRole(user.uid, "superadmin");
  await staff
    .doc(user.uid)
    .set({ name, email: normalized, role: "superadmin", status: "activo", invitedAt: new Date().toISOString(), invitedBy: "Configuración inicial" }, { merge: true });

  console.log(`✓ ${name} <${normalized}> es Superadministrador (uid ${user.uid}).`);
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
