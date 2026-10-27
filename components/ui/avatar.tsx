import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

export type AvatarTone = "blue" | "tint" | "deep" | "muted";

const tones: Record<AvatarTone, string> = {
  blue: "bg-elite-blue text-white",
  tint: "bg-blue-tint text-elite-blue",
  deep: "bg-deep-blue text-white",
  muted: "bg-sky text-ink-muted",
};

const sizes = {
  sm: "size-8 text-caption font-bold font-sans",
  md: "size-9 text-label font-display",
  lg: "size-10 text-body font-display",
  panel: "size-12 text-body-lg font-bold font-sans",
  xl: "size-[72px] text-headline font-display",
} as const;

export function Avatar({
  name,
  tone = "tint",
  size = "md",
  className,
}: {
  name: string;
  tone?: AvatarTone;
  size?: keyof typeof sizes;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn("inline-flex shrink-0 items-center justify-center rounded-full", tones[tone], sizes[size], className)}
    >
      {initials(name)}
    </span>
  );
}
