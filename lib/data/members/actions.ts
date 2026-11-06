"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { audit } from "@/lib/db/outbox";
import { adminAuth } from "@/lib/firebase/admin";

import type { Category, PlayingSide } from "../types";
import { categories } from "../types";
import { lockUser, NOT_AVAILABLE, suspendMember, withTx } from "../writes";

const refresh = () => revalidatePath("/", "layout");

// Members sign up in the app; the club doesn't create them nor keep private notes (yet).

export type NewMemberInput = {
  name: string;
  dni?: string;
  phone?: string;
  email?: string;
  category?: Category;
  side: PlayingSide;
  sendAppLink: boolean;
};

export async function addMember(_input: NewMemberInput): Promise<ActionResult<{ id: string }>> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

export async function saveInternalNote(_input: { id: string; text: string }): Promise<ActionResult> {
  return runAction("reservas.gestionar", () => {
    throw new Error(NOT_AVAILABLE);
  });
}

/** The club sets the category: the member sees it as verified in the app. */
export async function updateMemberCategory(input: { id: string; category: Category }): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) => {
    const value = categories.indexOf(input.category);
    if (value < 0) throw new Error("Elegí una categoría.");
    return withTx(async (tx) => {
      // categories goes 8ª … 1ª; in-api stores 8 … 1.
      const [user] = await tx`
        update app.users set category = ${8 - value}, category_verified = true
        where id = ${input.id} and deleted_at is null returning id`;
      if (!user) throw new Error("No encontramos ese socio.");
      await audit(tx, staff, "member.category_set", { type: "user", id: input.id }, { category: input.category });
      refresh();
      return undefined;
    });
  });
}

export async function blockMember(input: { id: string; reason: string }): Promise<ActionResult<{ cancelled: number }>> {
  return runAction("socios.bloquear", async (staff) => {
    const reason = input.reason.trim();
    if (reason.length < 5) throw new Error("Escribí el motivo: lo ve el socio.");
    const result = await withTx((tx) => suspendMember(tx, staff, input.id, reason));
    await adminAuth().revokeRefreshTokens(result.firebaseUid).catch(() => {});
    refresh();
    return { cancelled: result.cancelled };
  });
}

export async function unblockMember(id: string): Promise<ActionResult> {
  return runAction("socios.bloquear", (staff) =>
    withTx(async (tx) => {
      const user = await lockUser(tx, id);
      if (user.status !== "suspended") throw new Error("Ese socio no está bloqueado.");
      await tx`update app.users set status = 'active' where id = ${id}`;
      await audit(tx, staff, "member.unblocked", { type: "user", id });
      refresh();
      return undefined;
    }),
  );
}
