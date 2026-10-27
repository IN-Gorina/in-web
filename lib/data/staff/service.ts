import "server-only";

import { isFirebaseEnabled } from "@/lib/firebase/config";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { StaffMember } from "../types";
import { listStaffFromFirestore } from "./firebase";

export async function listStaff(): Promise<StaffMember[]> {
  if (isFirebaseEnabled) return listStaffFromFirestore();
  return mockResponse(db().staff);
}
