import "server-only";

import { unstable_rethrow } from "next/navigation";

import { getCurrentStaff } from "@/lib/data/session/service";
import type { StaffMember } from "@/lib/data/types";

import { can, type Permission } from "./permissions";

/** Result every server action returns, so forms can show the error inline. */
export type ActionResult<T = undefined> = { ok: true; data: T; message?: string } | { ok: false; error: string };

/**
 * Server actions are reachable by direct POST, so each one checks the caller's role here,
 * not only in the UI.
 */
export async function requirePermission(permission: Permission): Promise<StaffMember> {
  const staff = await getCurrentStaff();
  if (!can(staff.role, permission)) throw new Error("No tenés permiso para hacer esto.");
  return staff;
}

export async function runAction<T>(permission: Permission, run: (staff: StaffMember) => T | Promise<T>): Promise<ActionResult<T>> {
  try {
    const staff = await requirePermission(permission);
    return { ok: true, data: await run(staff) };
  } catch (error) {
    // No session: let getCurrentStaff's redirect to /ingresar or /sin-acceso through.
    unstable_rethrow(error);
    return { ok: false, error: error instanceof Error ? error.message : "Algo salió mal. Probá de nuevo." };
  }
}
