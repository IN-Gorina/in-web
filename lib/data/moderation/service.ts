import "server-only";

import { mockResponse } from "../backend";
import { db } from "../mock/store";
import type { Report } from "../types";

export async function listReports(): Promise<Report[]> {
  return mockResponse([...db().reports].sort((a, b) => b.count - a.count));
}
