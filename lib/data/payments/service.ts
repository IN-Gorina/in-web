import "server-only";

import { mockResponse } from "../backend";
import { seedPayments } from "../mock/seed";
import { db } from "../mock/store";
import type { Payment } from "../types";

export async function listPayments(): Promise<Payment[]> {
  return mockResponse([...db().payments].sort((a, b) => b.at.localeCompare(a.at)));
}

export type PaymentTotals = {
  collected: number;
  depositsCount: number;
  balancesCount: number;
  pendingAmount: number;
  pendingCount: number;
  refundsAmount: number;
  refundsCount: number;
  mpFees: number;
};

const seedIds = new Set(seedPayments.map((payment) => payment.id));

/**
 * Month totals shown on Pagos. The mock only stores the last few payments, so the totals start
 * from the design's numbers and add what was registered during this session.
 */
export async function getPaymentTotals(): Promise<PaymentTotals> {
  const payments = db().payments;
  const added = payments.filter((payment) => !seedIds.has(payment.id));
  const pending = payments.filter((payment) => payment.status === "pendiente" || payment.status === "vence-pronto");
  return mockResponse({
    collected: 3_912_000 + added.filter((p) => p.amount > 0).reduce((sum, p) => sum + p.amount, 0),
    depositsCount: 412,
    balancesCount: 380 + added.filter((p) => p.concept === "saldo").length,
    pendingAmount: 5000 + pending.reduce((sum, payment) => sum + payment.amount, 0),
    pendingCount: 1 + pending.length,
    refundsAmount: 15_000 + added.filter((p) => p.amount < 0).reduce((sum, p) => sum - p.amount, 0),
    refundsCount: 3 + added.filter((p) => p.amount < 0).length,
    mpFees: 132_500,
  });
}
