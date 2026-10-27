import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { getCurrentStaff } from "@/lib/data/session/service";
import { listStaff } from "@/lib/data/staff/service";

import { StaffView } from "./staff-view";

export const metadata: Metadata = { title: "Staff y permisos" };

const title = "Staff y permisos";
const subtitle = "Quién entra al panel y qué puede hacer cada rol";

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function StaffPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <StaffContent />
    </Suspense>
  );
}

async function StaffContent() {
  const me = await getCurrentStaff();
  if (!can(me.role, "staff.gestionar")) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <PermissionGate permission="staff.gestionar">{null}</PermissionGate>
      </>
    );
  }
  const staff = await listStaff();
  return <StaffView title={title} subtitle={subtitle} staff={staff} meId={me.id} />;
}
