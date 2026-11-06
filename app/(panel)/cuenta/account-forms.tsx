"use client";

import { signInWithEmailAndPassword, updatePassword } from "firebase/auth";
import { useState, type FormEvent } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { Card, CardTitle } from "@/components/ui/card";
import { TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { roleLabels, type StaffRole } from "@/lib/auth/permissions";
import { firebaseAuth, startSession } from "@/lib/firebase/client";
import { authMessage, errorCode } from "@/lib/firebase/errors";

/**
 * Signing in with the current password is the re-authentication. Changing the password revokes
 * existing sessions (including this cookie), so it signs in again with the new one and renews it.
 */
async function changePassword(email: string, current: string, next: string) {
  const auth = firebaseAuth();
  const { user } = await signInWithEmailAndPassword(auth, email, current);
  await updatePassword(user, next);
  const renewed = await signInWithEmailAndPassword(auth, email, next);
  await startSession(renewed.user);
}

/** Account menu destinations ("Mis datos", "Cambiar contraseña"). */
export function AccountForms({ name, email, role }: { name: string; email: string; role: StaffRole }) {
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [errors, setErrors] = useState<{ current?: string; next?: string; repeat?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: typeof errors = {};
    if (!current) found.current = "Escribí tu contraseña actual.";
    if (next.length < 8 || !/\d/.test(next)) found.next = "Usá al menos 8 caracteres y un número.";
    if (repeat !== next) found.repeat = "Las contraseñas no coinciden.";
    setErrors(found);
    if (Object.keys(found).length) return;
    setPending(true);
    try {
      await changePassword(email, current, next);
    } catch (error) {
      const code = errorCode(error);
      setErrors(
        code === "auth/invalid-credential" || code === "auth/wrong-password" ? { current: "La contraseña actual no coincide." } : { form: authMessage(error) },
      );
      return;
    } finally {
      setPending(false);
    }
    toast("Contraseña actualizada");
    setCurrent("");
    setNext("");
    setRepeat("");
  };

  return (
    <div className="flex items-start gap-5">
      <Card className="flex w-[420px] flex-col gap-5 p-6">
        <CardTitle title="Mis datos" />
        <div className="flex items-center gap-4">
          <Avatar name={name} tone="deep" size="panel" />
          <div className="flex flex-col gap-1">
            <p className="text-body font-bold text-ink">{name}</p>
            <p className="text-body-sm font-medium text-ink-muted">{email}</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-body-sm font-medium text-ink-muted">Rol</span>
          <Badge tone={role === "superadmin" ? "dark" : "info"}>{roleLabels[role]}</Badge>
        </div>
        <p className="text-caption font-medium text-ink-muted">Para cambiar tu nombre, correo o rol, pedíselo al superadministrador desde Staff y permisos.</p>
      </Card>

      <Card className="flex w-[460px] flex-col gap-5 p-6">
        <CardTitle title="Cambiar contraseña" />
        <form id="contrasena" onSubmit={submit} noValidate className="flex flex-col gap-4">
          <TextField label="Contraseña actual" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} error={errors.current} />
          <TextField label="Nueva contraseña" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} error={errors.next} message="8 caracteres o más, con al menos un número" />
          <TextField label="Repetí la nueva contraseña" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} error={errors.repeat} />
          {errors.form && <Callout tone="danger">{errors.form}</Callout>}
          <Button type="submit" size="lg" className="self-start" disabled={pending}>
            {pending ? "Guardando…" : "Guardar contraseña"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
