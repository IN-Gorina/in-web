import type { Metadata } from "next";
import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { PermissionGate } from "@/components/shell/permission-gate";
import { PageHeader } from "@/components/ui/page-header";
import { can } from "@/lib/auth/permissions";
import { listEvents } from "@/lib/data/events/service";
import { getAudienceSizes, listNotifications } from "@/lib/data/notifications/service";
import { getCurrentStaff } from "@/lib/data/session/service";
import { dayKey, now, time } from "@/lib/dates";

import { NotificationComposer } from "./composer";

export const metadata: Metadata = { title: "Notificaciones" };

const title = "Notificaciones";
const subtitle = "Mandá avisos push a todos los socios o a un grupo";

/** Own boundary: the page reads the session, and the panel layout's boundary doesn't cover navigations between pages. */
export default function NotificacionesPage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NotificacionesContent />
    </Suspense>
  );
}

async function NotificacionesContent() {
  const staff = await getCurrentStaff();
  if (!can(staff.role, "notificaciones.enviar")) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <PermissionGate permission="notificaciones.enviar">{null}</PermissionGate>
      </>
    );
  }

  const [sent, audience, events] = await Promise.all([listNotifications(), getAudienceSizes(), listEvents()]);
  const targets = [
    { value: "inicio", label: "Inicio de la app" },
    { value: "reservar", label: "Reservar una cancha" },
    { value: "partidos", label: "Social › Partidos" },
    ...events.filter((e) => e.status === "publicado").map((e) => ({ value: `evento:${e.id}`, label: `Evento · ${e.title}` })),
  ];
  return (
    <NotificationComposer
      title={title}
      subtitle={subtitle}
      sent={sent}
      audience={audience}
      targets={targets}
      today={dayKey(now())}
      nowTime={time(now())}
    />
  );
}
