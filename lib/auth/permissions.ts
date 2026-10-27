/*
 * Staff roles and what each one can do. Mirrors the matrix on Paper "Panel / 13 – Staff y permisos".
 * Roles are fixed in this version; once Firebase is in, the role comes from the user's custom claims.
 */

export const staffRoles = ["admin", "recepcion"] as const;
export type StaffRole = (typeof staffRoles)[number];

export const roleLabels: Record<StaffRole, string> = {
  admin: "Administrador",
  recepcion: "Recepción",
};

export const permissions = [
  "agenda.ver",
  "reservas.gestionar",
  "cobros.registrar",
  "turnosFijos.aprobar",
  "portal.moderar",
  "socios.bloquear",
  "notificaciones.enviar",
  "senas.devolver",
  "club.configurar",
  "staff.gestionar",
] as const;
export type Permission = (typeof permissions)[number];

const recepcion: readonly Permission[] = [
  "agenda.ver",
  "reservas.gestionar",
  "cobros.registrar",
  "turnosFijos.aprobar",
  "portal.moderar",
];

const grants: Record<StaffRole, readonly Permission[]> = {
  recepcion,
  admin: permissions,
};

export function can(role: StaffRole, permission: Permission): boolean {
  return grants[role].includes(permission);
}
