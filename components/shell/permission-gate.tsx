import type { ReactNode } from "react";

import { can, roleLabels, type Permission } from "@/lib/auth/permissions";
import { getCurrentStaff } from "@/lib/data/session/service";

import { Card } from "../ui/card";
import { EmptyState } from "../ui/states";

/**
 * Renders its children only for roles with `permission`. The sidebar already hides these
 * pages, so this covers someone opening the URL directly.
 */
export async function PermissionGate({ permission, children }: { permission: Permission; children: ReactNode }) {
  const staff = await getCurrentStaff();
  if (can(staff.role, permission)) return children;

  return (
    <Card className="flex flex-1 items-center justify-center">
      <EmptyState
        icon="lock"
        title="Esta sección es solo para administradores"
        description={`Tu rol es ${roleLabels[staff.role]}. Si necesitás entrar, pedíselo a un administrador del club.`}
      />
    </Card>
  );
}
