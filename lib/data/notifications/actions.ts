"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { now, nowIso, toIso } from "@/lib/dates";

import { db, newId } from "../mock/store";

export async function sendNotification(input: {
  title: string;
  body: string;
  audienceLabel: string;
  recipients: number;
  /** "YYYY-MM-DD" + "HH:mm" to schedule; omit to send now. */
  schedule?: { day: string; time: string };
}): Promise<ActionResult<{ scheduled: boolean }>> {
  return runAction("notificaciones.enviar", () => {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 3) throw new Error("Escribí un título.");
    if (title.length > 60) throw new Error("El título puede tener hasta 60 caracteres.");
    if (body.length < 3) throw new Error("Escribí el mensaje.");
    if (body.length > 140) throw new Error("El mensaje puede tener hasta 140 caracteres.");
    if (input.recipients <= 0) throw new Error("Elegí a quién le llega.");

    const at = input.schedule ? toIso(input.schedule.day, input.schedule.time) : nowIso();
    if (input.schedule && new Date(at) <= now()) throw new Error("Elegí un horario futuro para programarla.");

    db().notifications.push({
      id: newId("n"),
      title,
      body,
      audienceLabel: input.audienceLabel,
      status: input.schedule ? "programada" : "enviada",
      at,
      recipients: input.schedule ? undefined : input.recipients,
    });
    revalidatePath("/notificaciones");
    return { scheduled: Boolean(input.schedule) };
  });
}

export async function cancelScheduled(id: string): Promise<ActionResult> {
  return runAction("notificaciones.enviar", () => {
    const store = db();
    const notification = store.notifications.find((n) => n.id === id);
    if (!notification || notification.status !== "programada") throw new Error("Esa notificación ya no está programada.");
    store.notifications = store.notifications.filter((n) => n.id !== id);
    revalidatePath("/notificaciones");
    return undefined;
  });
}
