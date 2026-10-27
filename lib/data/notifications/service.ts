import "server-only";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { PushNotification } from "../types";

export async function listNotifications(): Promise<PushNotification[]> {
  return mockResponse([...db().notifications].sort((a, b) => b.at.localeCompare(a.at)));
}

/** Members with notifications on, by audience. Mock numbers until the backend can count them. */
export async function getAudienceSizes() {
  return mockResponse({
    todos: 1284,
    todosActivas: 1180,
    porCategoria: { "8ª": 64, "7ª": 118, "6ª": 214, "5ª": 198, "4ª": 151, "3ª": 88, "2ª": 41, "1ª": 12 } as Record<string, number>,
    turnoFijo: 18,
    temas: [
      { id: "torneos", label: "Torneos", size: 486 },
      { id: "partidos", label: "Partidos abiertos", size: 731 },
      { id: "canchas-liberadas", label: "Canchas liberadas", size: 402 },
    ],
  });
}
