import "server-only";

import type { StaffMember } from "../types";
import { listStaffFromFirestore } from "./firebase";

export async function listStaff(): Promise<StaffMember[]> {
  return listStaffFromFirestore();
}
