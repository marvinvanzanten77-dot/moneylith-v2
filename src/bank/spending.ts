import type {DebtLedger} from './debtPayments.js';
import {salaryPeriod,periodBounds} from './periodReconciliation.js';
import {costForMonth} from '../logic/monthlyCosts.js';
import type { MoneylithTransaction, FixedCostManualItem } from "../types";
import { isOperatingTransaction, spendingCategoryLabel, type BankRuleSettings } from "./classificationRules.js";
export type SpendingRow = { id: string; date: string; cents: number; label: string | null };
export type SpendingPot = { label: string; cents: number; count: number; share: number; previousCents: number | null };
const unknown = /^(onbekend|uncategorized|uncategorised|overig|other|geen categorie)$/i;
export function spendingRows(transactions: MoneylithTransaction[], rules: BankRuleSettings, fixed: FixedCostManualItem[] = [], ledger?:DebtLedger): SpendingRow[] {
  const knownFixed = new Set(fixed.flatMap(i => i.bankEvidence?.transactionIds ?? []));
  const seen = new Set<string>();
  return transactions.flatMap(t => {
    if (seen.has(t.id) || t.provider !== "lunchflow" || t.currency !== "EUR" || !Number.isFinite(t.amount) || t.amount >= 0 ||
      !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(Date.parse(t.date)) || new Date(t.date).toISOString().slice(0,10) !== t.date ||
      !isOperatingTransaction(t, rules) || t.bankPatternKind === "fixed" || knownFixed.has(t.id)) return [];
    seen.add(t.id);
    const manual = t.category && t.category !== t.bankPatternCategory ? t.category : null;
    const label = (manual || (t.bankPatternKind === "variable" ? t.category || t.bankRuleLabel : t.category))?.trim();
    const allocation=ledger?.entries.find(e=>e.transactionId===t.id);
    const assigned=allocation?allocation.allocations.reduce((n,a)=>n+a.cents,0)+(allocation.fixedAllocations??[]).reduce((n,a)=>n+a.cents,0):0;
    const remaining=Math.max(0,Math.abs(Math.round(t.amount*100))-assigned);if(!remaining)return [];
    return [{ id: t.id, date: t.date, cents: remaining, label: label && !unknown.test(label) ? spendingCategoryLabel(label) : null }];
  });
}
export function spendingSummary(rows: SpendingRow[], month: string, asOf: string, basis:"calendar"|"salary"="calendar") {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || !/^\d{4}-\d{2}-\d{2}$/.test(asOf) || !Number.isFinite(Date.parse(asOf))) throw Error("Ongeldige analyseperiode.");
  const previousDate = new Date(`${month}-01T00:00:00Z`); previousDate.setUTCMonth(previousDate.getUTCMonth() - 1);
  const previousMonth = previousDate.toISOString().slice(0, 7);
  const bounds=periodBounds(month),previousBounds=periodBounds(previousMonth);
  const elapsedDay = basis==='salary'?Math.min(Math.round((Date.parse(bounds.end)-Date.parse(bounds.start))/86400000)+1,Math.max(0,Math.round((Date.parse(asOf)-Date.parse(bounds.start))/86400000)+1)):month === asOf.slice(0, 7) ? Number(asOf.slice(8)) : 31;
  const seen = new Set<string>();
  const valid = rows.filter(r => {
    if (seen.has(r.id) || !Number.isSafeInteger(r.cents) || r.cents <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(r.date) || !Number.isFinite(Date.parse(r.date)) || new Date(r.date).toISOString().slice(0,10) !== r.date || r.date > asOf) return false;
    seen.add(r.id); return true;
  });
  const current = valid.filter(r => basis==='salary'?salaryPeriod(r.date)===month:r.date.startsWith(month));
  const previous = valid.filter(r => basis==='salary'?salaryPeriod(r.date)===previousMonth&&Math.round((Date.parse(r.date)-Date.parse(previousBounds.start))/86400000)<elapsedDay:r.date.startsWith(previousMonth) && Number(r.date.slice(8)) <= elapsedDay);
  const categorized = current.filter(r => r.label !== null);
  const map = new Map<string, { cents: number; count: number }>();
  for (const r of categorized) { const item = map.get(r.label!) ?? { cents: 0, count: 0 }; item.cents += r.cents; item.count++; map.set(r.label!, item); }
  const totalCents = current.length ? current.reduce((n,r) => n + r.cents,0) : null;
  const categorizedCents = categorized.reduce((n,r) => n + r.cents,0);
  const pots: SpendingPot[] = [...map].map(([label, item]) => ({ label, ...item, share: totalCents ? item.cents / totalCents : 0,
    // No observation in the previous period is unknown, never a fabricated zero.
    previousCents: previous.some(r => r.label === label) ? previous.filter(r => r.label === label).reduce((n,r) => n + r.cents,0) : null,
  })).sort((a,b) => b.cents - a.cents || a.label.localeCompare(b.label));
  return { month, previousMonth, elapsedDay, basis, start:basis==='salary'?bounds.start:month+'-01', end:basis==='salary'?bounds.end:new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5)),0)).toISOString().slice(0,10), totalCents, categorizedCents, unknownCents: current.filter(r => r.label === null).reduce((n,r) => n + r.cents,0), unknownCount: current.filter(r => r.label === null).length, count: current.length, pots };
}

/** Budget allocation is a view of transactions, never a mutation or an extra expense. */
export function spendingAboveBudgets(rows: SpendingRow[], fixed: FixedCostManualItem[], basis:"calendar"|"salary"="calendar") {
  const budgets = fixed.filter(i => i.budgetCategory && i.paymentRoute !== "withheld");
  const spent = new Map<string, number>();
  return rows.slice().sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).flatMap(row => {
    const month = basis==='salary'?salaryPeriod(row.date):row.date.slice(0,7);
    const matches = budgets.filter(i => i.budgetCategory === row.label && !!i.budgetSince && i.budgetSince <= month);
    // Ambiguous duplicate budgets must not silently absorb spending twice.
    if (matches.length !== 1) return [{...row}];
    const resolved=costForMonth(matches[0],month);if(resolved.amountEntered===false||(resolved.bedrag===0&&resolved.amountEntered!==true)||!Number.isFinite(resolved.bedrag)||resolved.bedrag<0)return [{...row}];
    const budget = Math.round(resolved.bedrag * 100), key = month + ":" + row.label;
    const prior = spent.get(key) ?? 0; spent.set(key, prior + row.cents);
    const excess = Math.max(0,prior+row.cents-budget)-Math.max(0,prior-budget);
    return excess ? [{...row,cents:excess,label:row.label + " — boven maandbudget"}] : [];
  });
}

/** Last three completed calendar months with observations; absent months are unknown. */
export function observedBudgetAverage(rows: SpendingRow[], label: string, asOf: string) {
  const end = asOf.slice(0,7), start = new Date(end + "-01T00:00:00Z"); start.setUTCMonth(start.getUTCMonth()-3);
  const from = start.toISOString().slice(0,7), totals = new Map<string, number>();
  for(const row of rows) {
    const month=row.date.slice(0,7);
    if(row.label===label && month>=from && month<end) totals.set(month,(totals.get(month)??0)+row.cents);
  }
  const months=[...totals.keys()].sort();
  return {months, cents:months.length ? Math.round([...totals.values()].reduce((s,n)=>s+n,0)/months.length) : null};
}
