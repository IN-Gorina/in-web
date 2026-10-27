import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PageHeader } from "@/components/ui/page-header";
import { getCurrentStaff } from "@/lib/data/session/service";

import { AccountForms } from "./account-forms";

export const metadata: Metadata = { title: "Mi cuenta" };

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function CuentaPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <CuentaContent />
    </Suspense>
  );
}

async function CuentaContent() {
  const staff = await getCurrentStaff();
  return (
    <>
      <PageHeader title="Mi cuenta" subtitle="Tus datos y tu contraseña para entrar al panel" />
      <AccountForms name={staff.name} email={staff.email} role={staff.role} />
    </>
  );
}
