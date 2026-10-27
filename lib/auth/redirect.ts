/** Where to go after signing in: only a path inside the panel, never another site (`//evil.com`, `/\evil.com`). */
export function localPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}
