import { Suspense } from "react";

import { PageSkeleton } from "@/components/shell/page-skeleton";
import { Sidebar, SidebarSkeleton } from "@/components/shell/sidebar";
import { ToastProvider } from "@/components/ui/toast";
import { getCurrentStaff } from "@/lib/data/session/service";

/*
 * Every panel page needs the signed-in staff member, which is read from the session cookie per
 * request. The sidebar streams in behind its boundary, and each page has its own (the one here
 * only covers navigating into the panel). Without a session, getCurrentStaff() redirects to
 * /ingresar (or /sin-acceso without a staff role).
 */
export default function PanelLayout({ children }: LayoutProps<"/">) {
  return (
    <ToastProvider>
      <div className="flex h-dvh overflow-hidden">
        <Suspense fallback={<SidebarSkeleton />}>
          <SessionSidebar />
        </Suspense>
        <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-y-auto px-8 py-7">
          <Suspense fallback={<PageSkeleton />}>{children}</Suspense>
        </main>
      </div>
    </ToastProvider>
  );
}

async function SessionSidebar() {
  const staff = await getCurrentStaff();
  return <Sidebar staff={staff} />;
}
