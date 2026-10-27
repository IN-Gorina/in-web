import type { Permission } from "@/lib/auth/permissions";
import type { AttentionCounts } from "@/lib/data/attention/service";

import type { IconName } from "../ui/icon";

export type NavItem = {
  href: string;
  label: string;
  icon: IconName;
  /** Hidden for roles without it. Items without a permission are visible to every role. */
  permission?: Permission;
  badge?: keyof AttentionCounts;
};

export type NavSection = { title: string; items: NavItem[] };

export const navSections: NavSection[] = [
  {
    title: "Operación",
    items: [
      { href: "/", label: "Resumen", icon: "dashboard" },
      { href: "/agenda", label: "Agenda", icon: "calendar" },
      { href: "/reservas", label: "Reservas", icon: "list" },
      { href: "/turnos-y-partidos", label: "Turnos y partidos", icon: "repeat", badge: "fixedSlotRequests" },
      { href: "/pagos", label: "Pagos", icon: "credit-card" },
    ],
  },
  {
    title: "Comunidad",
    items: [
      { href: "/socios", label: "Socios", icon: "users" },
      { href: "/moderacion", label: "Moderación", icon: "news", badge: "openReports" },
      { href: "/eventos", label: "Eventos", icon: "calendar-star" },
      { href: "/notificaciones", label: "Notificaciones", icon: "bell", permission: "notificaciones.enviar" },
    ],
  },
  {
    title: "Club",
    items: [
      { href: "/canchas-y-tarifas", label: "Canchas y tarifas", icon: "layout-grid", permission: "club.configurar" },
      { href: "/configuracion", label: "Configuración", icon: "adjustments", permission: "club.configurar" },
      { href: "/staff", label: "Staff y permisos", icon: "shield", permission: "staff.gestionar" },
    ],
  },
];

/** "/" only matches itself; other items also match their sub-pages (/socios/123). */
export function isActive(href: string, pathname: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}
