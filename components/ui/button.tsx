import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

import { cn } from "@/lib/cn";

import { Icon, type IconName } from "./icon";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "danger-outline";
type Size = "md" | "lg" | "xl";

const variants: Record<Variant, string> = {
  primary: "bg-elite-blue text-white hover:bg-deep-blue disabled:bg-ink-disabled",
  secondary: "bg-white text-ink border border-line hover:bg-field disabled:text-ink-disabled",
  ghost: "text-ink hover:bg-field disabled:text-ink-disabled",
  danger: "bg-danger text-white hover:brightness-90 disabled:bg-ink-disabled",
  "danger-outline": "bg-white text-danger border-[1.5px] border-danger-line hover:bg-danger-soft",
};

// md: page toolbars (Paper topbar buttons). lg: modal and drawer footers. xl: full-width auth forms.
const sizes: Record<Size, string> = {
  md: "h-10 px-4 gap-2 rounded-control text-label font-semibold",
  lg: "h-11 px-5 gap-2 rounded-md text-label font-bold",
  xl: "h-[52px] px-6 gap-2.5 rounded-md text-body font-bold",
};

const iconSizes: Record<Size, number> = { md: 18, lg: 16, xl: 18 };

type BaseProps = {
  variant?: Variant;
  size?: Size;
  icon?: IconName;
  fullWidth?: boolean;
  children: ReactNode;
  className?: string;
};

type ButtonProps = BaseProps & Omit<ComponentProps<"button">, keyof BaseProps>;
type LinkButtonProps = BaseProps & Omit<ComponentProps<typeof Link>, keyof BaseProps>;

function classes({ variant = "primary", size = "md", fullWidth, className }: BaseProps) {
  return cn(
    "inline-flex shrink-0 items-center justify-center whitespace-nowrap transition-colors disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    fullWidth && "w-full",
    className,
  );
}

export function Button({ variant, size = "md", icon, fullWidth, className, children, type = "button", ...rest }: ButtonProps) {
  return (
    <button type={type} className={classes({ variant, size, fullWidth, className, children })} {...rest}>
      {icon && <Icon name={icon} size={iconSizes[size]} strokeWidth={size === "md" ? 2.4 : 2} />}
      {children}
    </button>
  );
}

export function LinkButton({ variant, size = "md", icon, fullWidth, className, children, ...rest }: LinkButtonProps) {
  return (
    <Link className={classes({ variant, size, fullWidth, className, children })} {...rest}>
      {icon && <Icon name={icon} size={iconSizes[size]} strokeWidth={size === "md" ? 2.4 : 2} />}
      {children}
    </Link>
  );
}

/** Square icon button, e.g. the modal close (36px on field) or a row's "···". */
export function IconButton({
  icon,
  label,
  tone = "field",
  className,
  ...rest
}: Omit<ComponentProps<"button">, "children"> & { icon: IconName; label: string; tone?: "field" | "plain" | "white" }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex size-9 shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors",
        tone === "field" && "bg-field hover:bg-blue-tint",
        tone === "plain" && "hover:bg-field",
        tone === "white" && "bg-white hover:bg-field",
        className,
      )}
      {...rest}
    >
      <Icon name={icon} size={icon === "dots" ? 18 : 16} strokeWidth={icon === "dots" ? 3 : 2.4} />
    </button>
  );
}
