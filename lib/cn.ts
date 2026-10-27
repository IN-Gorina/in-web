type ClassValue = string | false | null | undefined;

/** Joins class names, skipping empty values. There is no merge step, so avoid passing
 * a class that conflicts with one the component already sets. */
export function cn(...classes: ClassValue[]): string {
  return classes.filter(Boolean).join(" ");
}
