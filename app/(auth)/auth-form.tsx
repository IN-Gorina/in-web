"use client";

import { signInWithEmailAndPassword, type User } from "firebase/auth";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Callout } from "@/components/ui/callout";
import { TextField } from "@/components/ui/field";
import { Icon } from "@/components/ui/icon";
import { localPath } from "@/lib/auth/redirect";
import { cn } from "@/lib/cn";
import { endSession, firebaseAuth, requestPasswordReset, signInWithGoogle, startSession } from "@/lib/firebase/client";
import { authMessage, errorCode, isCancelled } from "@/lib/firebase/errors";

/*
 * Login screens (Paper "Panel / 00a–00e"), backed by Firebase Auth. The browser signs in with the
 * JS SDK and trades the ID token for the session cookie (/api/session). Without Firebase config
 * ("Modo sin Firebase") they only validate the form and move on to the mock panel.
 */

const emailOk = (value: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value.trim());

/** Opens the session and goes to the panel, or to "Sin acceso" when the account has no staff role. */
function useEnterPanel() {
  const router = useRouter();
  return async (user: User) => {
    const { staff } = await startSession(user);
    router.replace(staff ? localPath(new URLSearchParams(window.location.search).get("next")) : "/sin-acceso");
    router.refresh();
  };
}

export function AuthHeader({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <Image src="/brand/in-gorina-blue.png" alt="IN Gorina" width={35} height={40} priority />
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-display tracking-tight text-ink">{title}</h1>
        <p className="text-body font-medium text-ink-muted">{subtitle}</p>
      </div>
    </div>
  );
}

function PasswordField({ label, value, onChange, error, aside }: { label: string; value: string; onChange: (v: string) => void; error?: string; aside?: ReactNode }) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      label={label}
      aside={aside}
      size="lg"
      type={visible ? "text" : "password"}
      autoComplete="current-password"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      error={error}
      trailing={
        <button type="button" onClick={() => setVisible((v) => !v)} aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"} className="text-ink-muted hover:text-ink">
          <Icon name={visible ? "eye-off" : "eye"} size={20} />
        </button>
      }
    />
  );
}

function GoogleButton({ label, onClick, disabled }: { label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex h-[52px] w-full items-center justify-center gap-2.5 rounded-md border-[1.5px] border-line bg-white text-body font-bold text-ink hover:bg-surface-muted disabled:opacity-60"
    >
      <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
        <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.6-.4-3.9z" />
        <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
        <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
        <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z" />
      </svg>
      {label}
    </button>
  );
}

function Divider() {
  return (
    <div className="flex items-center gap-3">
      <span className="h-px flex-1 bg-line" />
      <span className="text-caption font-semibold text-ink-muted">o</span>
      <span className="h-px flex-1 bg-line" />
    </div>
  );
}

// ── 00a Ingresar ──────────────────────────────────────────────────────

export function LoginForm() {
  const enterPanel = useEnterPanel();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!emailOk(email)) next.email = "Escribí un correo válido.";
    if (password.length < 8) next.password = "La contraseña tiene al menos 8 caracteres.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setPending(true);
    try {
      const { user } = await signInWithEmailAndPassword(firebaseAuth(), email.trim(), password);
      await enterPanel(user);
    } catch (error) {
      setErrors({ form: authMessage(error) });
      setPending(false);
    }
  };

  const google = async () => {
    setErrors({});
    setPending(true);
    try {
      await enterPanel(await signInWithGoogle());
    } catch (error) {
      if (!isCancelled(error)) setErrors({ form: authMessage(error) });
      setPending(false);
    }
  };

  return (
    <>
      <AuthHeader title="Ingresá al panel" subtitle="Usá el correo con el que te invitó el club." />
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <div className="flex flex-col gap-[18px]">
          <TextField label="Correo" size="lg" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={errors.email} />
          <PasswordField
            label="Contraseña"
            value={password}
            onChange={setPassword}
            error={errors.password}
            aside={
              <Link href={`/recuperar${emailOk(email) ? `?email=${encodeURIComponent(email.trim())}` : ""}`} className="text-body-sm font-bold text-link hover:underline">
                ¿La olvidaste?
              </Link>
            }
          />
        </div>
        {errors.form && <Callout tone="danger">{errors.form}</Callout>}
        <div className="flex flex-col gap-4">
          <Button type="submit" size="xl" fullWidth disabled={pending}>
            {pending ? "Ingresando…" : "Ingresar"}
          </Button>
          <Divider />
          <GoogleButton label="Continuar con Google" onClick={google} disabled={pending} />
        </div>
      </form>
      <p className="text-body-sm font-medium text-ink-muted">¿No tenés acceso? Pedíselo a un administrador del club.</p>
    </>
  );
}

// ── 00b Recuperar contraseña ──────────────────────────────────────────

export function RecoverForm({ initialEmail }: { initialEmail: string }) {
  const router = useRouter();
  const [email, setEmail] = useState(initialEmail);
  const [error, setError] = useState<string>();
  const [pending, setPending] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!emailOk(email)) return setError("Escribí un correo válido.");
    setPending(true);
    try {
      await requestPasswordReset(email.trim());
    } catch (error) {
      // An unknown email moves on as if it was sent, so this screen doesn't reveal who has an account.
      if (errorCode(error) !== "auth/user-not-found") {
        setError(authMessage(error));
        setPending(false);
        return;
      }
    }
    router.push(`/revisa-tu-correo?email=${encodeURIComponent(email.trim())}`);
  };

  return (
    <>
      <AuthHeader title="Recuperá tu contraseña" subtitle="Escribí tu correo y te mandamos un link para crear una nueva." />
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <TextField label="Correo" size="lg" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} error={error} />
        <Button type="submit" size="xl" fullWidth disabled={pending}>
          {pending ? "Enviando…" : "Enviar link"}
        </Button>
      </form>
      <Link href="/ingresar" className="text-body-sm font-bold text-link hover:underline">
        Volver a ingresar
      </Link>
    </>
  );
}

// ── 00c Revisá tu correo ──────────────────────────────────────────────

export function CheckEmail({ email }: { email: string }) {
  const [wait, setWait] = useState(60);
  useEffect(() => {
    if (wait <= 0) return;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  return (
    <>
      <AuthHeader title="Revisá tu correo" subtitle="Te mandamos un link para crear una contraseña nueva." />
      <div className="flex items-center gap-3.5 rounded-md bg-blue-tint p-4">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-elite-blue text-white">
          <Icon name="mail" size={20} />
        </span>
        <div className="flex min-w-0 flex-col gap-0.5">
          <p className="truncate text-label font-bold text-ink">{email || "tu correo"}</p>
          <p className="text-caption font-medium text-ink-muted">El link vence en 1 hora</p>
        </div>
      </div>
      <div className="flex flex-col gap-4">
        <Link href="/ingresar" className="flex h-[52px] items-center justify-center rounded-md bg-elite-blue text-body font-bold text-white hover:bg-deep-blue">
          Volver a ingresar
        </Link>
        <button
          type="button"
          disabled={wait > 0}
          onClick={() => {
            setWait(60);
            if (emailOk(email)) requestPasswordReset(email.trim()).catch(() => {});
          }}
          className="h-[52px] rounded-md border-[1.5px] border-line bg-white text-body font-bold text-ink hover:bg-surface-muted disabled:text-ink-disabled"
        >
          {wait > 0 ? `Reenviar link en ${wait} s` : "Reenviar link"}
        </button>
      </div>
      <p className="text-body-sm font-medium text-ink-muted">¿No llegó? Revisá spam o promociones.</p>
    </>
  );
}

// ── 00d Aceptar invitación ────────────────────────────────────────────

export function AcceptInvite({ invite }: { invite: { token: string; email: string; invitedBy: string; role: string; expires: string } | null }) {
  const enterPanel = useEnterPanel();
  const [password, setPassword] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string>();
  const longEnough = password.length >= 8;
  const hasNumber = /\d/.test(password);

  if (!invite) {
    return (
      <>
        <AuthHeader title="La invitación venció" subtitle="Los links de invitación duran 7 días. Pedile a un administrador que te mande uno nuevo." />
        <Link href="/ingresar" className="text-body-sm font-bold text-link hover:underline">
          Ir a ingresar
        </Link>
      </>
    );
  }

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (!longEnough || !hasNumber) return;
    setPending(true);
    setFormError(undefined);
    try {
      const response = await fetch("/api/invitacion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: invite.token, password }),
      });
      const body = (await response.json().catch(() => ({}))) as { email?: string; error?: string };
      if (!response.ok || !body.email) throw new Error(body.error ?? "Algo salió mal. Probá de nuevo en un rato.");
      const { user } = await signInWithEmailAndPassword(firebaseAuth(), body.email, password);
      await enterPanel(user);
    } catch (error) {
      setFormError(error instanceof Error && !errorCode(error) ? error.message : authMessage(error));
      setPending(false);
    }
  };

  /** Accepting with Google works when it's the Google account of the invited email (same Firebase user). */
  const google = async () => {
    setPending(true);
    setFormError(undefined);
    try {
      const user = await signInWithGoogle();
      if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
        await endSession();
        throw new Error(`Elegí la cuenta de Google de ${invite.email}.`);
      }
      await enterPanel(user);
    } catch (error) {
      if (!isCancelled(error)) setFormError(error instanceof Error && !errorCode(error) ? error.message : authMessage(error));
      setPending(false);
    }
  };

  return (
    <>
      <AuthHeader title="Sumate al panel" subtitle={`${invite.invitedBy} te invitó como ${invite.role}. Creá tu contraseña para entrar.`} />
      <form onSubmit={submit} noValidate className="flex flex-col gap-8">
        <div className="flex flex-col gap-[18px]">
          <TextField label="Correo" size="lg" value={invite.email} readOnly disabled trailing={<Icon name="lock" size={16} className="text-ink-disabled" />} />
          <div className="flex flex-col gap-2">
            <PasswordField label="Creá una contraseña" value={password} onChange={setPassword} />
            <div className="flex gap-4">
              <Requirement ok={longEnough} failed={submitted && !longEnough} label="8 caracteres o más" />
              <Requirement ok={hasNumber} failed={submitted && !hasNumber} label="Al menos un número" />
            </div>
          </div>
        </div>
        {formError && <Callout tone="danger">{formError}</Callout>}
        <div className="flex flex-col gap-4">
          <Button type="submit" size="xl" fullWidth disabled={pending}>
            {pending ? "Creando tu cuenta…" : "Crear cuenta y entrar"}
          </Button>
          <Divider />
          <GoogleButton label="Usar mi cuenta de Google" onClick={google} disabled={pending} />
        </div>
      </form>
      <p className="text-body-sm font-medium text-ink-muted">La invitación vence el {invite.expires}. Si se vence, pedí una nueva.</p>
    </>
  );
}

function Requirement({ ok, failed, label }: { ok: boolean; failed: boolean; label: string }) {
  return (
    <span className={cn("flex items-center gap-1.5 text-caption font-semibold", ok ? "text-success" : failed ? "text-danger" : "text-ink-muted")}>
      {ok ? <Icon name="check" size={14} strokeWidth={3} /> : <span className="size-3.5 rounded-full border-2 border-current" />}
      {label}
    </span>
  );
}

// ── 00e Sin acceso ────────────────────────────────────────────────────

export function NoAccess({ name, email }: { name: string; email: string }) {
  const router = useRouter();
  const leave = async () => {
    await endSession();
    router.replace("/ingresar");
    router.refresh();
  };
  return (
    <>
      <AuthHeader title="Esta cuenta no tiene acceso" subtitle="No tiene un rol en el panel. Puede que te hayan quitado el acceso o que hayas entrado con tu cuenta de socio." />
      <div className="flex items-center gap-3 rounded-md border-[1.5px] border-line px-4 py-3.5">
        <Avatar name={name} tone="muted" size="lg" />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <p className="truncate text-label font-bold text-ink">{name}</p>
          <p className="truncate text-caption font-medium text-ink-muted">{email}</p>
        </div>
        <Badge tone="danger">Sin acceso</Badge>
      </div>
      <div className="flex flex-col gap-4">
        <Button size="xl" fullWidth onClick={leave}>
          Ingresar con otra cuenta
        </Button>
        <Button size="xl" variant="secondary" fullWidth onClick={leave}>
          Cerrar sesión
        </Button>
      </div>
      <p className="text-body-sm font-medium text-ink-muted">Si creés que es un error, pedile a un administrador que te invite de nuevo.</p>
    </>
  );
}
