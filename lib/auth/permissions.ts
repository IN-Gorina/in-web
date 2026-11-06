/*
 * Staff roles and what each one can do. The role comes from the user's `staff_role` custom claim
 * (not `role`: the app's Supabase Realtime needs `role: authenticated` in the same Firebase project).
 * There is a single superadmin, set by scripts/make-superadmin.ts; everyone invited from the panel
 * is an admin.
 */

export const staffRoles = ["superadmin", "admin"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const roleLabels: Record<StaffRole, string> = {
  superadmin: "Superadministrador",
  admin: "Administrador",
};

export const permissions = [
  "agenda.ver",
  "reservas.gestionar",
  "turnosFijos.aprobar",
  "portal.moderar",
  "socios.bloquear",
  "senas.devolver",
  "club.configurar",
  "staff.gestionar",
] as const;
export type Permission = (typeof permissions)[number];

const grants: Record<StaffRole, readonly Permission[]> = {
  superadmin: permissions,
  admin: permissions.filter((permission) => permission !== "staff.gestionar"),
};

export function can(role: StaffRole, permission: Permission): boolean {
  return grants[role].includes(permission);
}
