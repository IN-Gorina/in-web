import type { BadgeTone } from "@/components/ui/badge";

import type { Member, PlayingSide } from "../types";

export const sideLabels: Record<PlayingSide, string> = { drive: "Drive", reves: "Revés", indistinto: "Indistinto" };

export function memberStatus(member: Member): { label: string; tone: BadgeTone } {
  switch (member.status) {
    case "activo":
      return { label: "Activo", tone: "success" };
    case "nuevo":
      return { label: "Nuevo", tone: "info" };
    case "preinscripto":
      return { label: "Pre-inscripto", tone: "warning" };
    case "sin-categoria":
      return { label: "Sin categoría", tone: "neutral" };
    case "bloqueado":
      return { label: "Bloqueado", tone: "danger" };
  }
}

const categoryNames: Record<string, string> = {
  "8ª": "Octava",
  "7ª": "Séptima",
  "6ª": "Sexta",
  "5ª": "Quinta",
  "4ª": "Cuarta",
  "3ª": "Tercera",
  "2ª": "Segunda",
  "1ª": "Primera",
};

export function categoryName(category: string): string {
  return categoryNames[category] ?? category;
}
