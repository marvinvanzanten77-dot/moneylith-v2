import { matchingBankRule, emptyBankRules, type BankRuleSettings } from "./classificationRules.js";
import type { FixedCostManualItem, IncomeItem, MoneylithTransaction } from "../types";
export type PatternKind = "income" | "fixed" | "variable" | "transfer" | "financing" | "ignore";
export type PatternDecision = { kind: PatternKind; label: string; targetId?: string };
export type PatternDecisions = Record<string, PatternDecision>;
export type Cadence = "weekly" | "fortnightly" | "fourweekly" | "monthly" | "quarterly" | "yearly" | "irregular";
export const cadenceLabels: Record<Cadence, string> = { weekly: "Wekelijks", fortnightly: "Elke twee weken", fourweekly: "Elke vier weken", monthly: "Maandelijks", quarterly: "Per kwartaal", yearly: "Jaarlijks", irregular: "Onregelmatig / nog onzeker" };
export type BankPattern = {
  key: string; label: string; accountId: string; incoming: boolean; transactions: MoneylithTransaction[];
  frequency: Cadence; monthlyEstimate: number | null; average: number; total: number;
  firstDate: string; lastDate: string; varying: boolean; possibleTransfer: boolean; active: boolean;
};
const day = (s: string) => Date.parse(s + "T00:00:00Z") / 86400000;
const normalize = (s: string) => s.normalize("NFKC").toLowerCase().trim().replace(/\s+/g, " ");
const cents = (n: number) => Math.round(n * 100);
const generic = /^(sepa|incasso|betaling|overboeking)$|^(paypal|mollie|adyen|sumup|stripe|tikkie)\b/i;
export function patternKey(tx: MoneylithTransaction) {
  if (tx.bankRuleId) return JSON.stringify(["bank-rule-v1", tx.accountId, tx.amount > 0 ? "in" : "out", tx.bankRuleId]);
  const party = normalize(tx.providerData?.counterparty ?? tx.counterparty ?? "");
  // Processors are not merchants: retain the description to avoid combining unrelated purchases.
  const description = normalize(tx.providerData?.description ?? tx.description).replace(/\b\d{4}-\d{2}-\d{2}\b/g, "").replace(/\b\d{2}[/-]\d{2}[/-]\d{4}\b/g, "").replace(/\s+/g, " ").trim();
  const identity = party && !generic.test(party) ? party : `${party}|${description}`;
  return JSON.stringify(["bank-pattern-v1", tx.accountId, tx.amount > 0 ? "in" : "out", identity || tx.id]);
}
const periods: { frequency: Cadence; days: number; tolerance: number; factor: number }[] = [
  { frequency: "weekly", days: 7, tolerance: 2, factor: 52 / 12 },
  { frequency: "fortnightly", days: 14, tolerance: 3, factor: 26 / 12 },
  { frequency: "monthly", days: 30.44, tolerance: 5, factor: 1 },
  { frequency: "quarterly", days: 91.31, tolerance: 10, factor: 1 / 3 },
  { frequency: "yearly", days: 365.25, tolerance: 14, factor: 1 / 12 },
];
export function detectCadence(dates: string[]) {
  const sorted = [...dates].sort();
  const gaps = sorted.slice(1).map((date, i) => day(date) - day(sorted[i]));
  if (!gaps.length || gaps.some(g => g <= 0)) return null;
  // Several exact 28-day gaps distinguish four-weekly from calendar-monthly.
  if (gaps.length >= 3 && gaps.every(g => Math.abs(g - 28) <= 1))
    return { frequency: "fourweekly" as Cadence, days: 28, tolerance: 1, factor: 13 / 12 };
  return periods.find(p => gaps.every(g => Math.abs(g - p.days) <= p.tolerance)) ?? null;
}
export function indexBankPatterns(transactions: MoneylithTransaction[], asOf: string, days = 365): BankPattern[] {
  const end = day(asOf);
  if (!Number.isFinite(end) || ![90, 180, 365, 730].includes(days)) throw Error("Ongeldige analyseperiode.");
  const seen = new Set<string>();
  const rows = transactions.filter(t => {
    if (seen.has(t.id) || t.provider !== "lunchflow" || t.currency !== "EUR" || !Number.isFinite(t.amount) || t.amount === 0 ||
        !/^\d{4}-\d{2}-\d{2}$/.test(t.date) || !Number.isFinite(day(t.date)) || new Date(t.date).toISOString().slice(0, 10) !== t.date || day(t.date) > end || day(t.date) < end - days) return false;
    seen.add(t.id); return true;
  });
  const byAmount = new Map<number, MoneylithTransaction[]>();
  for (const t of rows) { const key = cents(t.amount); const group = byAmount.get(key) ?? []; group.push(t); byAmount.set(key, group); }
  const transferIds = new Set<string>();
  for (const t of rows) {
    if (/eigen rekening|spaarrekening|interne overboeking|internal transfer/i.test(`${t.description} ${t.category ?? ""}`)) transferIds.add(t.id);
    for (const other of byAmount.get(-cents(t.amount)) ?? [])
      if (other.accountId !== t.accountId && Math.abs(day(t.date) - day(other.date)) <= 3) { transferIds.add(t.id); transferIds.add(other.id); }
  }
  const groups = new Map<string, MoneylithTransaction[]>();
  for (const t of rows) { const key = patternKey(t); const group = groups.get(key) ?? []; group.push(t); groups.set(key, group); }
  return [...groups].map(([key, raw]) => {
    const ts = raw.slice().sort((a, b) => a.date.localeCompare(b.date));
    const latest = ts[ts.length - 1];
    const amounts = ts.map(t => Math.abs(cents(t.amount)));
    const total = amounts.reduce((s, n) => s + n, 0), mean = Math.round(total / ts.length);
    const cadence = detectCadence(ts.map(t => t.date));
    return {
      key, label: latest.bankRuleLabel || latest.counterparty?.trim() || latest.description || "Onbekende tegenpartij", accountId: latest.accountId,
      incoming: latest.amount > 0, transactions: ts, frequency: cadence?.frequency ?? "irregular" as Cadence,
      monthlyEstimate: cadence && !latest.bankRuleId ? Math.round(mean * cadence.factor) / 100 : null,
      average: mean / 100, total: total / 100, firstDate: ts[0].date, lastDate: latest.date,
      varying: amounts.some(n => Math.abs(n - mean) > Math.max(1, mean * 0.1)),
      possibleTransfer: ts.some(t => transferIds.has(t.id)),
      active: end - day(latest.date) <= Math.max(45, (cadence?.days ?? 30) * 1.5),
    };
  }).sort((a, b) => b.transactions.length - a.transactions.length || b.total - a.total || a.key.localeCompare(b.key));
}
export function classifyBankTransactions(transactions: MoneylithTransaction[], decisions: PatternDecisions, settings: BankRuleSettings = emptyBankRules) {
  return transactions.map(tx => {
    if (tx.provider !== "lunchflow") return tx;
    const original = { ...tx, bankRuleId: undefined, bankRuleLabel: undefined };
    const rule = matchingBankRule(original, settings);
    const grouped = rule ? { ...original, bankRuleId: rule.id, bankRuleLabel: rule.label } : original;
    // Previously saved merchant decisions and explicit group corrections outrank automatic rules.
    const decision = decisions[patternKey(original)] ?? decisions[patternKey(grouped)];
    const chosen = decision ?? rule;
    if (!chosen) {
      if (!tx.bankRuleId) return tx;
      return { ...original, category: tx.category === tx.bankPatternCategory ? undefined : tx.category,
        bankPatternCategory: undefined, bankPatternKind: undefined };
    }
    const managed = !tx.category || tx.category === tx.bankPatternCategory;
    const category = decision?.kind === "transfer" ? "Eigen overboeking" : chosen.label;
    return { ...(decision && decisions[patternKey(original)] ? original : grouped), category: managed ? category : tx.category,
      bankPatternCategory: managed ? category : tx.bankPatternCategory, bankPatternKind: chosen.kind };
  });
}
export function applyPatternDecision(
  pattern: BankPattern, decision: PatternDecision, monthly: number | null, paymentDay: number,
  income: IncomeItem[], fixedCosts: FixedCostManualItem[], decisions: PatternDecisions,
) {
  if (!decision.label.trim() || !["income", "fixed", "variable", "transfer", "financing", "ignore"].includes(decision.kind)) throw Error("Geef aan wat deze betaling betekent.");
  const nextIncome = [...income], nextFixed = [...fixedCosts];
  const previous = decisions[pattern.key];
  if (previous?.targetId && (income.some(i => i.id === previous.targetId) || fixedCosts.some(i => i.id === previous.targetId)))
    throw Error("Deze betaling is al gekoppeld. Bewerk de bijbehorende post in Fundament.");
  const next = { ...decision, label: decision.label.trim() };
  if (next.kind === "income" || next.kind === "fixed") {
    if ((next.kind === "income") !== pattern.incoming) throw Error("De gekozen soort past niet bij de richting van deze betaling.");
    const target = next.kind === "income" ? nextIncome : nextFixed;
    const evidence = { key: pattern.key, transactionIds: pattern.transactions.map(t => t.id), through: pattern.lastDate };
    if (next.targetId && next.targetId !== "new") {
      const index = target.findIndex(i => i.id === next.targetId);
      if (index < 0) throw Error("De gekozen post bestaat niet meer.");
      // Explicit linking never replaces a manual amount, label or payment day.
      target[index] = { ...target[index], bankEvidence: evidence };
    } else {
      if (monthly === null || !Number.isFinite(monthly) || monthly < 0 || monthly > 1e9 || !Number.isInteger(paymentDay) || paymentDay < 0 || paymentDay > 31)
        throw Error("Vul een geldig maandbedrag in. Laat een onbekende betaaldag leeg.");
      const id = `bank-confirmed:${encodeURIComponent(pattern.key)}`;
      if (target.some(i => i.id === id)) throw Error("Deze post bestaat al. Koppel de bestaande post.");
      target.push({ id, naam: next.label, bedrag: Math.round(monthly * 100) / 100, amountEntered: true, dagVanMaand: paymentDay,
        bankEvidence: evidence, opmerking: `Door jou benoemd vanuit banktransacties. ${cadenceLabels[pattern.frequency]}; maandbedrag is een verwachting. Controleer de volledigheid van Fundament.` });
      next.targetId = id;
    }
  } else delete next.targetId;
  return { income: nextIncome, fixedCosts: nextFixed, decisions: { ...decisions, [pattern.key]: next } };
}
