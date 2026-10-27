"use server";

import { revalidatePath } from "next/cache";

import { runAction, type ActionResult } from "@/lib/auth/guard";
import { dayKey, now, nowIso } from "@/lib/dates";

import { db, newId } from "../mock/store";
import type { Category, Member, PlayingSide } from "../types";

const refresh = () => revalidatePath("/", "layout");

export type NewMemberInput = {
  name: string;
  dni?: string;
  phone?: string;
  email?: string;
  category?: Category;
  side: PlayingSide;
  sendAppLink: boolean;
};

export async function addMember(input: NewMemberInput): Promise<ActionResult<{ id: string }>> {
  return runAction("reservas.gestionar", () => {
    const store = db();
    const name = input.name.trim().replace(/\s+/g, " ");
    if (name.split(" ").length < 2) throw new Error("Escribí nombre y apellido.");
    const phone = input.phone?.trim();
    const email = input.email?.trim().toLowerCase();
    if (!phone && !email) throw new Error("Cargá un teléfono o un correo para poder avisarle.");
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw new Error("Revisá el correo.");
    if (input.sendAppLink && !phone) throw new Error("Para mandarle el link por WhatsApp hace falta el teléfono.");
    const dni = input.dni?.replace(/\D/g, "");
    if (dni && (dni.length < 7 || dni.length > 8)) throw new Error("Revisá el DNI: tiene que tener 7 u 8 números.");
    if (email && store.members.some((m) => m.email === email)) throw new Error("Ya hay un socio con ese correo.");

    const member: Member = {
      id: newId("m"),
      name,
      phone: phone || undefined,
      email: email || undefined,
      dni: dni ? Number(dni).toLocaleString("es-AR") : undefined,
      category: input.category,
      categoryChosenBy: input.category ? "club" : undefined,
      side: input.side,
      status: input.category ? "nuevo" : "sin-categoria",
      memberSince: dayKey(now()),
      matchesPlayed: 0,
      bookingsCount: 0,
      cancellations: 0,
      paidThisYear: 0,
      usesApp: false,
      notificationsOn: false,
    };
    store.members.push(member);
    refresh();
    return { id: member.id };
  });
}

export async function updateMemberCategory(input: { id: string; category: Category }): Promise<ActionResult> {
  return runAction("reservas.gestionar", () => {
    const member = db().members.find((m) => m.id === input.id);
    if (!member) throw new Error("No encontramos ese socio.");
    member.category = input.category;
    member.categoryChosenBy = "club";
    if (member.status === "sin-categoria") member.status = "activo";
    refresh();
    return undefined;
  });
}

export async function saveInternalNote(input: { id: string; text: string }): Promise<ActionResult> {
  return runAction("reservas.gestionar", (staff) => {
    const member = db().members.find((m) => m.id === input.id);
    if (!member) throw new Error("No encontramos ese socio.");
    const text = input.text.trim();
    member.internalNote = text ? { text, by: staff.name, at: dayKey(now()) } : undefined;
    refresh();
    return undefined;
  });
}

/** Blocks a member: cancels their upcoming bookings and refunds paid deposits. Admin only. */
export async function blockMember(input: { id: string; reason: string }): Promise<ActionResult<{ cancelled: number }>> {
  return runAction("socios.bloquear", (staff) => {
    const store = db();
    const member = store.members.find((m) => m.id === input.id);
    if (!member) throw new Error("No encontramos ese socio.");
    if (member.status === "bloqueado") throw new Error(`${member.name} ya está bloqueado.`);
    const reason = input.reason.trim();
    if (reason.length < 5) throw new Error("Escribí el motivo: lo ve el socio.");
    member.status = "bloqueado";
    member.blocked = { at: dayKey(now()), reason };

    let cancelled = 0;
    for (const booking of store.bookings) {
      if (booking.organizer.memberId !== member.id || booking.cancelled || new Date(booking.start) < now()) continue;
      booking.cancelled = { at: nowIso(), by: staff.name };
      if (booking.depositStatus === "pagada") booking.depositStatus = "devuelta";
      booking.history.unshift({ at: nowIso(), text: "Cancelada al bloquear al socio · seña devuelta", by: staff.name });
      cancelled++;
    }
    refresh();
    return { cancelled };
  });
}

export async function unblockMember(id: string): Promise<ActionResult> {
  return runAction("socios.bloquear", () => {
    const member = db().members.find((m) => m.id === id);
    if (!member || member.status !== "bloqueado") throw new Error("Ese socio no está bloqueado.");
    member.status = member.category ? "activo" : "sin-categoria";
    member.blocked = undefined;
    refresh();
    return undefined;
  });
}
