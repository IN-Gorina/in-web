"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { can } from "@/lib/auth/permissions";
import { audit } from "@/lib/db/outbox";
import { adminAuth } from "@/lib/firebase/admin";

import { suspendMember, withTx } from "../writes";

const refresh = () => revalidatePath("/", "layout");

/** Hides a reported post (Report.id is the post id); optionally blocks its author. */
export async function hidePost(input: { id: string; reason: string; blockAuthor: boolean }): Promise<ActionResult> {
  return runAction("portal.moderar", async (staff) => {
    if (input.blockAuthor && !can(staff.role, "socios.bloquear")) throw new Error("No tenés permiso para bloquear socios.");
    const firebaseUid = await withTx(async (tx) => {
      const [post] = await tx<{ author_id: string }[]>`
        update app.posts set status = 'hidden' where id = ${input.id} and status <> 'hidden' returning author_id`;
      if (!post) throw new Error("Esa publicación ya está oculta.");
      await audit(tx, staff, "post.hidden", { type: "post", id: input.id }, { reason: input.reason });
      if (!input.blockAuthor) return null;
      const result = await suspendMember(tx, staff, post.author_id, `Publicación oculta: ${input.reason.toLowerCase()}`);
      return result.firebaseUid;
    });
    if (firebaseUid) await adminAuth().revokeRefreshTokens(firebaseUid).catch(() => {});
    refresh();
    return undefined;
  });
}

/** The reports were unfounded: the post stays and leaves the queue until someone reports it again. */
export async function dismissReport(id: string): Promise<ActionResult> {
  return runAction("portal.moderar", (staff) =>
    withTx(async (tx) => {
      await audit(tx, staff, "report.dismissed", { type: "post", id });
      refresh();
      return undefined;
    }),
  );
}

export async function restorePost(id: string): Promise<ActionResult> {
  return runAction("portal.moderar", (staff) =>
    withTx(async (tx) => {
      const [post] = await tx`update app.posts set status = 'published' where id = ${id} and status = 'hidden' returning id`;
      if (!post) throw new Error("Esa publicación no está oculta.");
      await audit(tx, staff, "post.restored", { type: "post", id });
      // Restoring means the reports were unfounded.
      await audit(tx, staff, "report.dismissed", { type: "post", id });
      refresh();
      return undefined;
    }),
  );
}
