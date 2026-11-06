import type { Metadata } from "next";
import { Suspense } from "react";

import { getSignedInAccount } from "@/lib/data/session/service";

import { AuthHeader, NoAccess } from "../auth-form";

export const metadata: Metadata = { title: "Sin acceso" };

/** Where the session check sends someone signed in without a staff role (a member of the app, or access removed). */
export default function SinAccesoPage() {
  return (
    <Suspense fallback={<AuthHeader title="Esta cuenta no tiene acceso" subtitle="Revisando tu cuenta…" />}>
      <SignedInAccount />
    </Suspense>
  );
}

async function SignedInAccount() {
  const account = await getSignedInAccount();
  return <NoAccess name={account?.name ?? "Sin sesión"} email={account?.email ?? ""} />;
}
