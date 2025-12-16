import type { MoneylithBucket, MoneylithBucketType, MoneylithTransaction } from "../types";

const normalize = (value?: string) =>
  (value ?? "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");

const monthsBetween = (from: Date, to: Date) => {
  const years = to.getFullYear() - from.getFullYear();
  const months = to.getMonth() - from.getMonth();
  return years * 12 + months + 1; // inclusive window
};

export function deriveBuckets(
  transactions: MoneylithTransaction[],
  options?: { monthsWindow?: number }
): MoneylithBucket[] {
  if (!transactions?.length) return [];
  const monthsWindow = options?.monthsWindow ?? 6;
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - monthsWindow + 1);

  const recent = transactions.filter((t) => {
    if (!t) return false;
    if (!t.date) return false;
    const d = new Date(t.date);
    if (Number.isNaN(d.getTime())) return false;
    if (typeof t.amount !== "number" || !Number.isFinite(t.amount)) return false;
    return d >= cutoff;
  });
  if (!recent.length) return [];

  const groups = new Map<string, MoneylithTransaction[]>();

  for (const tx of recent) {
    const key = `${normalize(tx.description)}::${normalize(tx.counterparty ?? "")}`;
    const safeKey = key.trim() || `group-${normalize(tx.accountId) || "unknown"}`;
    if (!groups.has(safeKey)) groups.set(safeKey, []);
    groups.get(safeKey)!.push(tx);
  }

  const buckets: MoneylithBucket[] = [];

  groups.forEach((items, key) => {
    if (!items.length) return;
    const sorted = [...items].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    const amounts = items.map((i) => i.amount).filter((a) => typeof a === "number" && Number.isFinite(a));
    if (!amounts.length) return;
    const allPos = amounts.every((a) => a > 0);
    const allNeg = amounts.every((a) => a < 0);

    // recurring check
    const avg = amounts.reduce((s, a) => s + Math.abs(a), 0) / amounts.length;
    const variance =
      amounts.reduce((s, a) => s + Math.pow(Math.abs(a) - avg, 2), 0) / Math.max(amounts.length, 1);
    const stddev = Math.sqrt(variance);
    const recurring = amounts.length >= 2 && avg > 0 && stddev <= avg * 0.2;

    let bucketType: MoneylithBucketType = "other";
    if (allPos) bucketType = "income";
    else if (allNeg && recurring) bucketType = "fixed";
    else if (allNeg && !recurring) bucketType = "variable";

    const firstDate = new Date(sorted[0].date);
    const windowMonths = Number.isNaN(firstDate.getTime()) ? 1 : Math.max(monthsBetween(firstDate, new Date()), 1);
    const sum = amounts.reduce((s, a) => s + Math.abs(a), 0);
    const monthlyAvg = sum / windowMonths;
    const lastAmount = Math.abs(sorted[sorted.length - 1].amount ?? 0);

    buckets.push({
      id: key,
      label: items[0].description || key || "Onbekende groep",
      type: bucketType,
      monthlyAvg,
      lastAmount,
      recurring,
      sampleTransactions: items.slice(0, 5).map((i) => i.id),
    });
  });

  return buckets;
}

export function mergeWithUserOverrides(
  autoBuckets: MoneylithBucket[],
  overrides: Record<string, Partial<MoneylithBucket>>
): MoneylithBucket[] {
  if (!autoBuckets?.length) return [];
  return autoBuckets.map((bucket) => {
    const override = overrides[bucket.id];
    if (!override) return bucket;
    return { ...bucket, ...override, userLocked: true };
  });
}
