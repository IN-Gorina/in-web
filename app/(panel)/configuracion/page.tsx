import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { getClubSettings } from "@/lib/data/club/service";
import { getCurrentStaff } from "@/lib/data/session/service";
import { dayKey, now } from "@/lib/dates";

import { SettingsForm } from "./settings-form";

export const metadata: Metadata = { title: "Configuración del club" };

const title = "Configuración del club";
const subtitle = "Datos, horario de apertura, días cerrados y categorías";

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function ConfiguracionPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <ConfiguracionContent />
    </Suspense>
  );
}

async function ConfiguracionContent() {
  const staff = await getCurrentStaff();
  if (!can(staff.role, "club.configurar")) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <PermissionGate permission="club.configurar">{null}</PermissionGate>
      </>
    );
  }
  const settings = await getClubSettings();
  return <SettingsForm title={title} subtitle={subtitle} settings={settings} today={dayKey(now())} />;
}
