import type { FixedCostManualItem, IncomeItem, MoneylithTransaction } from "../types";

export type BankEvidence = {
  key: string;
  transactionIds: string[];
  through: string;
};
type Candidate = {
  id: string;
  naam: string;
  bedrag: number;
  dagVanMaand: number;
  opmerking: string;
  bankEvidence: BankEvidence;
  kind: "income" | "fixed";
};
const cents = (n: number) => Math.round(n * 100);
const normalized = (s: string) => s.toLowerCase().trim().replace(/\s+/g, " ");
const day = (s: string) => Date.parse(`${s}T00:00:00Z`) / 86400000;
const salary = /\b(salaris|salary|loon|payroll)\b/i;
const fixed = /\b(incasso|direct debit|huur|rent|hypotheek|mortgage|abonnement|subscription|premie)\b/i;
const transfer = /\b(spaarrekening|savings|eigen rekening|interne overboeking|internal transfer)\b/i;
const refund = /\b(refund|terugbetaling|restitutie|storno|terugboeking)\b/i;

/** Conservative bank observations, not an assessment of affordability.
 * Three consecutive monthly observations are required. Never infer debt principal.
 * Ambiguous equal/opposite transfers are excluded rather than counted as income.
 */
export function analyzeFinancialImport(transactions: MoneylithTransaction[], asOf: string) {
  const end = day(asOf);
  if (!Number.isFinite(end)) throw Error("Ongeldige analysedatum.");
  const recent = transactions.filter(t =>
    t.provider === "lunchflow" && t.currency === "EUR" &&
    Number.isFinite(t.amount) && t.amount !== 0 &&
    /^\d{4}-\d{2}-\d{2}$/.test(t.date) &&
    day(t.date) <= end && day(t.date) >= end - 120,
  );
  const internal = new Set<string>();
  const byAmount = new Map<number, MoneylithTransaction[]>();
  for (const t of recent) {
    const amount = cents(t.amount);
    byAmount.set(amount, [...(byAmount.get(amount) ?? []), t]);
  }
  for (const t of recent) {
    if (transfer.test(`${t.description} ${t.counterparty ?? ""} ${t.category ?? ""}`) ||
        /^(transfer|overboeking|sparen)$/i.test(t.category ?? "")) internal.add(t.id);
    for (const other of byAmount.get(-cents(t.amount)) ?? []) {
      if (t.accountId !== other.accountId && Math.abs(day(t.date) - day(other.date)) <= 3) {
        internal.add(t.id);
        internal.add(other.id);
      }
    }
  }
  const groups = new Map<string, MoneylithTransaction[]>();
  for (const t of recent) {
    if (t.bankPatternKind || internal.has(t.id) || refund.test(`${t.description} ${t.category ?? ""}`)) continue;
    // A stable named counterparty is required; do not group on generic SEPA prefixes.
    const party = normalized(t.counterparty ?? "");
    if (!party || ["sepa", "incasso", "betaling", "overboeking"].includes(party)) continue;
    const kind = t.amount > 0 ? "income" : "fixed";
    if (!(kind === "income" ? salary : fixed).test(t.description)) continue;
    const key = `${t.accountId}:${kind}:${party}`;
    groups.set(key, [...(groups.get(key) ?? []), t]);
  }
  const candidates: Candidate[] = [];
  for (const [key, raw] of groups) {
    const ts = raw.slice().sort((a, b) => a.date.localeCompare(b.date));
    // Multiple payments to the same party in one month are ambiguous.
    if (ts.length < 3 || new Set(ts.map(t => t.date.slice(0, 7))).size !== ts.length) continue;
    const latest = ts[ts.length - 1];
    if (end - day(latest.date) > 40) continue;
    if (ts.some((t, i) => i > 0 && (day(t.date) - day(ts[i - 1].date) < 25 || day(t.date) - day(ts[i - 1].date) > 35))) continue;
    const amounts = ts.map(t => Math.abs(cents(t.amount)));
    const mean = Math.round(amounts.reduce((sum, n) => sum + n, 0) / amounts.length);
    const kind = latest.amount > 0 ? "income" : "fixed";
    // Salary can vary (hours, allowances); its monthly cadence and explicit
    // salary description establish the observation, never a guaranteed future amount.
    if (kind === "fixed" && amounts.some(n => Math.abs(n - mean) > mean * 0.1)) continue;
    candidates.push({
      id: `bank-recurring:${encodeURIComponent(key)}`,
      naam: latest.counterparty!.trim(),
      bedrag: Math.abs(cents(latest.amount)) / 100,
      dagVanMaand: Number(latest.date.slice(8, 10)),
      opmerking: `Uit bankgegevens: ${ts.length} maandelijkse betalingen. Bedrag en dag van de laatste betaling; controleer of deze blijven gelden.`,
      bankEvidence: { key, transactionIds: ts.map(t => t.id), through: latest.date },
      kind,
    });
  }
  const recognized = new Set(candidates.flatMap(c => c.bankEvidence.transactionIds));
  const other = recent.filter(t => t.amount < 0 && t.bankPatternKind !== "fixed" && t.bankPatternKind !== "transfer" && t.bankPatternKind !== "financing" && !internal.has(t.id) && !recognized.has(t.id) && day(t.date) > end - 30);
  return {
    candidates,
    excludedTransfers: internal.size,
    otherOutflows30Days: other.reduce((sum, t) => sum + Math.abs(cents(t.amount)), 0) / 100,
    otherOutflowCount: other.length,
  };
}

/** Add only previously unseen observations. Existing records, including edits,
 * explicit zeroes and deleted suggestions, are never overwritten/recreated.
 * When a section already has manual entries, matching needs user judgement.
 */
export function prefillFinancialImport(
  transactions: MoneylithTransaction[],
  income: IncomeItem[],
  fixedCosts: FixedCostManualItem[],
  seen: string[],
  asOf: string,
  hasReviewedDetectedCosts = false,
) {
  const analysis = analyzeFinancialImport(transactions, asOf);
  const nextIncome = [...income], nextFixed = [...fixedCosts], nextSeen = new Set(seen);
  const blocked: Candidate[] = [];
  let addedIncome = 0, addedFixed = 0;
  for (const candidate of analysis.candidates) {
    if (nextSeen.has(candidate.id) || [...income, ...fixedCosts].some(i => i.id === candidate.id)) continue;
    const existing = candidate.kind === "income" ? income : fixedCosts;
    if (existing.some(i => !i.bankEvidence) || (candidate.kind === "fixed" && hasReviewedDetectedCosts)) {
      blocked.push(candidate);
      continue;
    }
    const { kind, ...item } = candidate;
    if (kind === "income") { nextIncome.push(item); addedIncome++; }
    else { nextFixed.push(item); addedFixed++; }
    nextSeen.add(candidate.id);
  }
  return { ...analysis, income: nextIncome, fixedCosts: nextFixed, seen: [...nextSeen], blocked, addedIncome, addedFixed };
}
