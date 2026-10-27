import "server-only";

import { mockResponse } from "../backend";
import { db } from "../mock/store";

/** Counts behind the red badges in the sidebar. */
export type AttentionCounts = {
  fixedSlotRequests: number;
  openReports: number;
};

export async function getAttentionCounts(): Promise<AttentionCounts> {
  const store = db();
  return mockResponse({
    fixedSlotRequests: store.fixedSlots.filter((slot) => slot.status === "pedido").length,
    openReports: store.reports.filter((report) => report.status === "abierta").length,
  });
}
