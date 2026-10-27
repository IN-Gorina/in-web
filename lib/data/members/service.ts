import "server-only";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { Member } from "../types";

/** Club totals for the Socios header; the mock list only holds a sample of members. */
export type MemberTotals = { active: number; newThisMonth: number; preRegistered: number };

export async function listMembers(): Promise<Member[]> {
  return mockResponse([...db().members].sort((a, b) => (b.lastActivity ?? "").localeCompare(a.lastActivity ?? "")));
}

export async function getMember(id: string): Promise<Member | null> {
  return mockResponse(db().members.find((member) => member.id === id) ?? null);
}

export async function getMemberTotals(): Promise<MemberTotals> {
  return mockResponse({ active: 1284, newThisMonth: 86, preRegistered: 142 });
}
