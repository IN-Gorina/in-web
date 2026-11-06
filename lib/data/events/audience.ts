import type { Category, EventAudience, Sex } from "../types";

/** in-api stores female / male. */
export const sexToDb = (sex: Sex | null) => (sex === "femenino" ? "female" : sex === "masculino" ? "male" : null);
export const sexFromDb = (value: string | null | undefined): Sex | undefined =>
  value === "female" ? "femenino" : value === "male" ? "masculino" : undefined;

/** "5ª" → 5 (users.category). */
export const categoryNumber = (category: Category) => Number.parseInt(category, 10);

export const sexLabels: Record<Sex, string> = { femenino: "Femenino", masculino: "Masculino" };

/** "Todos", "Femenino", "5ª y 6ª", "4ª, 5ª y 6ª · Masculino": the label the app shows too. */
export function audienceLabel(audience: EventAudience): string {
  const parts: string[] = [];
  if (audience.categories?.length) {
    const names = [...new Set(audience.categories)].sort((a, b) => categoryNumber(a) - categoryNumber(b));
    parts.push(names.length === 1 ? names[0]! : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`);
  }
  if (audience.sex) parts.push(sexLabels[audience.sex]);
  return parts.length ? parts.join(" · ") : "Todos";
}
