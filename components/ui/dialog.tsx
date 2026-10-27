"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Button, IconButton } from "./button";
import { Icon, type IconName } from "./icon";

/**
 * Native <dialog> opened with showModal(): focus trapping, Esc and the top layer come
 * from the browser. The scrim is styled with dialog::backdrop in globals.css.
 */
function useNativeDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return {
    ref,
    onCancel: (event: React.SyntheticEvent) => {
      event.preventDefault();
      onClose();
    },
    // A click whose target is the <dialog> itself landed on the backdrop.
    onClick: (event: React.MouseEvent<HTMLDialogElement>) => {
      if (event.target === event.currentTarget) onClose();
    },
  };
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  /** Right side of the header, before the close button ("Vista previa"). */
  headerAside?: ReactNode;
  footer?: ReactNode;
  width?: number;
  children: ReactNode;
};

/** Centered modal: Viga title, field-colored close button, body and a footer row with a top border. */
export function Modal({ open, onClose, title, subtitle, headerAside, footer, width = 560, children }: ModalProps) {
  const dialog = useNativeDialog(open, onClose);
  return (
    <dialog
      {...dialog}
      style={{ width }}
      className="m-auto max-h-[calc(100dvh-48px)] max-w-[calc(100vw-32px)] overflow-hidden rounded-modal bg-white p-0 text-ink shadow-modal open:flex open:flex-col"
    >
      {open && (
        <>
          <header className="flex shrink-0 items-start justify-between gap-4 px-6 pb-4 pt-6">
            <div className="flex min-w-0 flex-col gap-1">
              <h2 className="font-display text-headline text-ink">{title}</h2>
              {subtitle && <p className="text-body-sm font-medium text-ink-muted">{subtitle}</p>}
            </div>
            <div className="flex items-center gap-3">
              {headerAside}
              <IconButton icon="x" label="Cerrar" onClick={onClose} />
            </div>
          </header>
          <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-6 pb-5">{children}</div>
          {footer && (
            <footer className="flex shrink-0 items-center gap-3 border-t border-line px-6 py-4">{footer}</footer>
          )}
        </>
      )}
    </dialog>
  );
}

/** Side panel that slides over the page from the right (booking and event detail). */
export function Drawer({
  open,
  onClose,
  width = 460,
  children,
  label,
}: {
  open: boolean;
  onClose: () => void;
  width?: number;
  children: ReactNode;
  label: string;
}) {
  const dialog = useNativeDialog(open, onClose);
  return (
    <dialog
      {...dialog}
      aria-label={label}
      style={{ width }}
      className="my-0 ml-auto mr-0 h-dvh max-h-dvh max-w-full overflow-hidden bg-white p-0 text-ink shadow-drawer open:flex open:flex-col"
    >
      {open && children}
    </dialog>
  );
}

/** Close button positioned for drawers and covers. */
export function DrawerClose({ onClose, tone = "field" }: { onClose: () => void; tone?: "field" | "white" }) {
  return <IconButton icon="x" label="Cerrar" onClick={onClose} tone={tone} />;
}

/**
 * Confirmation for actions that can't be undone or that notify a member. The confirm button
 * repeats the action ("Bloquear socio"), never "Aceptar".
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel,
  icon = "alert",
  tone = "danger",
  pending = false,
  children,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  icon?: IconName;
  tone?: "danger" | "primary";
  pending?: boolean;
  /** Extra options (refund choice, reason chips, a note). */
  children?: ReactNode;
}) {
  const dialog = useNativeDialog(open, onClose);
  return (
    <dialog
      {...dialog}
      className="m-auto w-[520px] max-w-[calc(100vw-32px)] overflow-hidden rounded-modal bg-white p-0 text-ink shadow-modal"
    >
      {open && (
        <>
          <div className="flex flex-col gap-4 p-6">
            <span
              className={cn(
                "flex size-11 items-center justify-center rounded-md",
                tone === "danger" ? "bg-danger-soft text-danger" : "bg-blue-tint text-elite-blue",
              )}
            >
              <Icon name={icon} size={22} />
            </span>
            <div className="flex flex-col gap-1.5">
              <h2 className="font-display text-title-2 text-ink">{title}</h2>
              {description && <div className="text-label font-medium text-ink-muted">{description}</div>}
            </div>
            {children}
          </div>
          <footer className="flex justify-end gap-3 border-t border-line px-6 py-4">
            <Button variant="ghost" size="lg" onClick={onClose}>
              Volver
            </Button>
            <Button variant={tone === "danger" ? "danger" : "primary"} size="lg" onClick={onConfirm} disabled={pending}>
              {confirmLabel}
            </Button>
          </footer>
        </>
      )}
    </dialog>
  );
}
