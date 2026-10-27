"use client";

import { useRouter } from "next/navigation";

import { roleLabels, type StaffRole } from "@/lib/auth/permissions";
import { cn } from "@/lib/cn";
import { endSession } from "@/lib/firebase/client";

import { Avatar } from "../ui/avatar";
import { Menu } from "../ui/menu";

/** User card at the bottom of the sidebar. Opens the account menu (Paper "Panel / 15"). */
export function AccountMenu({ name, email, role }: { name: string; email: string; role: StaffRole }) {
  const router = useRouter();

  return (
    <Menu
      placement="top-start"
      width={272}
      items={[
        {
          type: "header",
          label: (
            <div className="flex flex-col gap-0.5">
              <p className="text-label font-bold leading-[18px] text-ink">{name}</p>
              <p className="text-caption font-medium text-ink-muted">
                {email} · {roleLabels[role]}
              </p>
            </div>
          ),
        },
        { type: "separator" },
        { label: "Mis datos", icon: "user", onSelect: () => router.push("/cuenta") },
        { label: "Cambiar contraseña", icon: "lock", onSelect: () => router.push("/cuenta#contrasena") },
        { label: "Ayuda del panel", icon: "help", onSelect: () => router.push("/ayuda") },
        { type: "separator" },
        {
          label: "Cerrar sesión",
          icon: "logout",
          tone: "danger",
          onSelect: async () => {
            await endSession();
            router.replace("/ingresar");
            router.refresh();
          },
        },
      ]}
      trigger={(props) => (
        <button
          type="button"
          aria-label={`Cuenta de ${name}`}
          {...props}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md p-3 text-left transition-colors",
            props["aria-expanded"] ? "bg-blue-tint" : "bg-surface-muted hover:bg-field",
          )}
        >
          <Avatar name={name} tone="deep" size="md" />
          <span className="flex min-w-0 flex-1 flex-col">
            <span className="truncate text-body-sm font-semibold text-ink">{name}</span>
            <span className="text-caption font-medium text-ink-muted">{roleLabels[role]}</span>
          </span>
        </button>
      )}
    />
  );
}
