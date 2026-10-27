"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { dayKey, now } from "@/lib/dates";

import { db } from "../mock/store";

const refresh = () => revalidatePath("/", "layout");

/** Hides a reported post; optionally blocks its author (admins only). The author is told why. */
export async function hidePost(input: { id: string; reason: string; blockAuthor: boolean }): Promise<ActionResult> {
  return runAction("portal.moderar", (staff) => {
    const store = db();
    const report = store.reports.find((r) => r.id === input.id);
    if (!report || report.status !== "abierta") throw new Error("Esa denuncia ya fue resuelta.");
    if (input.blockAuthor && !can(staff.role, "socios.bloquear")) throw new Error("Solo un administrador puede bloquear socios.");
    report.status = "oculta";
    report.reason = input.reason;
    if (input.blockAuthor) {
      const member = store.members.find((m) => m.id === report.author.memberId);
      if (member && member.status !== "bloqueado") {
        member.status = "bloqueado";
        member.blocked = { at: dayKey(now()), reason: `Publicación oculta por ${input.reason.toLowerCase()}` };
      }
    }
    refresh();
    return undefined;
  });
}

export async function dismissReport(id: string): Promise<ActionResult> {
  return runAction("portal.moderar", () => {
    const report = db().reports.find((r) => r.id === id);
    if (!report || report.status !== "abierta") throw new Error("Esa denuncia ya fue resuelta.");
    report.status = "descartada";
    refresh();
    return undefined;
  });
}

export async function restorePost(id: string): Promise<ActionResult> {
  return runAction("portal.moderar", () => {
    const report = db().reports.find((r) => r.id === id);
    if (!report || report.status !== "oculta") throw new Error("Esa publicación no está oculta.");
    report.status = "descartada";
    refresh();
    return undefined;
  });
}
