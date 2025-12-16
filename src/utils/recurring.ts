import type { Transaction } from "../types";

export type RecurringCandidate = {
  id: string;
  descriptionPattern: string;
  averageAmount: number;
  sampleCount: number;
  frequency: "monthly" | "weekly" | "yearly" | "unknown";
  lastDate: string;
  estimatedMonthlyAmount: number;
};

export function detectRecurringCandidates(transactions: Transaction[]): RecurringCandidate[] {
  if (!transactions.length) return [];

  const groups: Record<string, Transaction[]> = {};

  for (const tx of transactions) {
    const key = tx.description.toLowerCase().split(/[\s\/\-]/)[0].trim();

    if (!groups[key]) groups[key] = [];
    if (tx.amount < 0) groups[key].push(tx);
  }

  const results: RecurringCandidate[] = [];

  for (const [pattern, items] of Object.entries(groups)) {
    if (items.length < 3) continue;

    const sorted = items.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    const diffs: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      const prev = new Date(sorted[i - 1].date).getTime();
      const curr = new Date(sorted[i].date).getTime();
      diffs.push(Math.abs(curr - prev) / (1000 * 60 * 60 * 24));
    }

    const avgDiff = diffs.reduce((a, b) => a + b, 0) / diffs.length;

    let frequency: RecurringCandidate["frequency"] = "unknown";
    if (avgDiff > 25 && avgDiff < 35) frequency = "monthly";
    else if (avgDiff > 6 && avgDiff < 9) frequency = "weekly";
    else if (avgDiff > 350 && avgDiff < 380) frequency = "yearly";

    const avgAmount = items.reduce((sum, i) => sum + Math.abs(i.amount), 0) / items.length;

    let estimatedMonthlyAmount = avgAmount;
    if (frequency === "weekly") estimatedMonthlyAmount *= 4;
    if (frequency === "yearly") estimatedMonthlyAmount /= 12;

    results.push({
      id: pattern,
      descriptionPattern: pattern,
      averageAmount: avgAmount,
      sampleCount: items.length,
      frequency,
      lastDate: sorted[sorted.length - 1].date,
      estimatedMonthlyAmount,
    });
  }

  return results;
}
