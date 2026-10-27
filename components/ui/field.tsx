import { useId, type ComponentProps, type ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

/** Label row above a control: bold label on the left, optional hint ("Opcional", "0 / 600") on the right. */
export function FieldLabel({ htmlFor, label, aside }: { htmlFor?: string; label: string; aside?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <label htmlFor={htmlFor} className="text-body-sm font-bold text-ink">
        {label}
      </label>
      {aside && <span className="text-caption font-medium text-ink-muted">{aside}</span>}
    </div>
  );
}

/** Wraps any control with a label and an optional message underneath. */
export function Field({
  label,
  aside,
  message,
  error,
  children,
  htmlFor,
  className,
}: {
  label: string;
  aside?: ReactNode;
  message?: ReactNode;
  error?: string;
  children: ReactNode;
  htmlFor?: string;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-2", className)}>
      <FieldLabel htmlFor={htmlFor} label={label} aside={aside} />
      {children}
      {error ? (
        <p className="flex items-center gap-1.5 text-caption font-semibold text-danger">
          <Icon name="alert" size={14} />
          {error}
        </p>
      ) : (
        message && <p className="text-caption font-medium text-ink-muted">{message}</p>
      )}
    </div>
  );
}

const inputBase =
  "w-full min-w-0 bg-transparent text-ink placeholder:text-ink-disabled placeholder:font-medium focus:outline-none disabled:text-ink-muted";

type InputSize = "md" | "lg";

/** Filled input used in modals (44px) and auth forms (48px). */
export function TextInput({
  size = "md",
  icon,
  trailing,
  invalid,
  className,
  ...rest
}: Omit<ComponentProps<"input">, "size"> & {
  size?: InputSize;
  icon?: IconName;
  trailing?: ReactNode;
  invalid?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2.5 bg-field px-3.5 focus-within:ring-2 focus-within:ring-elite-blue",
        size === "md" ? "h-11 rounded-control" : "h-12 rounded-md px-4",
        invalid && "ring-2 ring-danger",
        className,
      )}
    >
      {icon && <Icon name={icon} size={16} className="text-ink-muted" />}
      <input
        className={cn(inputBase, size === "md" ? "text-label font-semibold" : "text-body font-semibold")}
        aria-invalid={invalid || undefined}
        {...rest}
      />
      {trailing}
    </div>
  );
}

export function TextArea({ className, invalid, ...rest }: ComponentProps<"textarea"> & { invalid?: boolean }) {
  return (
    <textarea
      className={cn(
        inputBase,
        "min-h-[76px] resize-y rounded-control bg-field px-3.5 py-3 text-label font-medium focus:ring-2 focus:ring-elite-blue",
        invalid && "ring-2 ring-danger",
        className,
      )}
      aria-invalid={invalid || undefined}
      {...rest}
    />
  );
}

/** Text input with its own label, for the common case. */
export function TextField({
  label,
  aside,
  message,
  error,
  id,
  className,
  inputClassName,
  ...input
}: ComponentProps<typeof TextInput> & {
  label: string;
  aside?: ReactNode;
  message?: ReactNode;
  error?: string;
  /** Applies to the wrapper (label + input), e.g. "flex-1" in a row of fields. */
  className?: string;
  inputClassName?: string;
}) {
  const generated = useId();
  const inputId = id ?? generated;
  return (
    <Field label={label} aside={aside} message={message} error={error} htmlFor={inputId} className={className}>
      <TextInput id={inputId} invalid={Boolean(error)} className={inputClassName} {...input} />
    </Field>
  );
}

/** White bordered search box used in page toolbars. */
export function SearchInput({ className, ...rest }: Omit<ComponentProps<"input">, "type">) {
  return (
    <div
      className={cn(
        "flex h-10 shrink-0 items-center gap-2.5 rounded-control border border-line bg-white px-3.5 focus-within:ring-2 focus-within:ring-elite-blue",
        className ?? "w-80",
      )}
    >
      <Icon name="search" size={18} className="text-ink-muted" />
      <input type="search" className={cn(inputBase, "text-label font-medium placeholder:text-ink-muted")} {...rest} />
    </div>
  );
}
