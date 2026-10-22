import type { MoneylithTransaction, FixedCostManualItem } from "../types";
import { isOperatingTransaction, type BankRuleSettings } from "./classificationRules.js";
export type SpendingRow = { id: string; date: string; cents: number; label: string | null };
export type SpendingPot = { label: string; cents: number; count: number; share: number; previousCents: number | null };
const unknown = /^(onbekend|uncategorized|uncategorised|overig|other|geen categorie)$/i;
export function spendingRows(transactions: MoneylithTransaction[], rules: BankRuleSettings, fixed: FixedCostManualItem[] = []): SpendingRow[] {
  const knownFixed = new Set(fixed.flatMap(i => i.bankEvidence?.transactionIds ?? []));
  const seen = new Set<string>();
  return transactions.flatMap(t => {
    if (seen.has(t.id) || t.provider !== "lunchflow" || t.currency !== "EUR" || !Number.isFinite(t.amount) || t.amount >= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(Date.parse(t.date)) || new Date(t.date).toISOString().slice(0,10) !== t.date ||
      !isOperatingTransaction(t, rules) || t.bankPatternKind === "fixed" || knownFixed.has(t.id)) return [];
    seen.add(t.id);
    const manual = t.category && t.category !== t.bankPatternCategory ? t.category : null;
    const label = (manual || (t.bankPatternKind === "variable" ? t.category || t.bankRuleLabel : t.category))?.trim();
    return [{ id: t.id, date: t.date, cents: Math.abs(Math.round(t.amount * 100)), label: label && !unknown.test(label) ? label : null }];
  });
}
export function spendingSummary(rows: SpendingRow[], month: string, asOf: string) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw Error("Ongeldige analyseperiode.");
  const previousDate = new Date(`${month}-01T00:00:00Z`); previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);
  const elapsedDay = month === asOf.slice(0, 7) ? Number(asOf.slice(8)) : 31;
  const seen = new Set<string>();
  const valid = rows.filter(r => {
    if (seen.has(r.id) || !Number.isSafeInteger(r.cents) || r.cents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10) !== r.date || r.date > asOf) return false;
    seen.add(r.id); return true;
  });
  const current = valid.filter(r => r.date.startsWith(month));
  const previous = valid.filter(r => r.date.startsWith(previousMonth) && Number(r.date.slice(8)) <= elapsedDay);
  const categorized = current.filter(r => r.label !== null);
  const map = new Map<string, { cents: number; count: number }>();
  for (const r of categorized) { const item = map.get(r.label!) ?? { cents: 0, count: 0 }; item.cents += r.cents; item.count++; map.set(r.label!, item); }
  const totalCents = current.length ? current.reduce((n,r) => n + r.cents,0) : null;
  const categorizedCents = categorized.reduce((n,r) => n + r.cents,0);
  const pots: SpendingPot[] = [...map].map(([label, item]) => ({ label, ...item, share: totalCents ? item.cents / totalCents : 0,
    // No observation in the previous period is unknown, never a fabricated zero.
    previousCents: previous.some(r => r.label === label) ? previous.filter(r => r.label === label).reduce((n,r) => n + r.cents,0) : null,
  })).sort((a,b) => b.cents - a.cents || a.label.localeCompare(b.label));
  return { month, previousMonth, elapsedDay, totalCents, categorizedCents, unknownCents: current.filter(r => r.label === null).reduce((n,r) => n + r.cents,0), unknownCount: current.filter(r => r.label === null).length, count: current.length, pots };
}
