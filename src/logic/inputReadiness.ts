import {costForMonth,currentCostMonth} from "./monthlyCosts.js";
export type ReviewKey = "income" | "fixed" | "debts" | "assets";
export type InputReviews = Partial<Record<ReviewKey, string | null>>;
export type ReviewRow = { id: string; name: string; amount: number; complete?: boolean; details?: unknown };
export type InputSection = {
  key: ReviewKey;
  label: string;
  total: number;
  signature: string;
  valid: boolean;
  ready: boolean;
  hasRows: boolean;
  bankVerified?: boolean;
};

export function manualReviewRows(items: { id: string; naam: string; bedrag: number; amountEntered?: boolean; reviewedInput?: string; paymentRoute?: string; budgetCategory?: string; amountRange?: {min:number;max:number}; monthlyVariable?:boolean; monthlyAmounts?:Record<string,number|null> }[], month=currentCostMonth()): ReviewRow[] {
  return items.map(({reviewedInput: _receipt, ...raw}) => { const item=costForMonth(raw,month); return ({
    id: item.id, name: item.naam, amount: item.paymentRoute === "withheld" ? 0 : item.bedrag,
    complete: item.amountEntered !== false && (item.bedrag !== 0 || item.amountEntered === true),
    ...((item.paymentRoute || item.budgetCategory || item.amountRange || item.monthlyAmounts) ? {details: {...item,...(item.monthlyAmounts&&item.monthlyVariable!==false?{effectiveMonth:month}:{})}} : {}),
  });});
}

// A numeric default is not evidence. Only a review of these exact inputs is.
export function reviewSection(key: ReviewKey, label: string, rows: ReviewRow[], reviews: InputReviews): InputSection {
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const valid = Number.isFinite(total) && rows.every((row) =>
    typeof row.name === "string" && row.name.trim().length > 0 && Number.isFinite(row.amount) && row.amount >= 0 && row.complete !== false,
  );
  const signature = JSON.stringify({ version: 1, key, rows });
  return { key, label, total, signature, valid, ready: valid && reviews[key] === signature, hasRows: rows.length > 0 };
}

export function missingInputs(sections: InputSection[]) {
  return sections.filter((section) => !section.ready).map((section) => section.label);
}

export function foundationStatus(income: InputSection, fixed: InputSection, goalPayments: number[]) {
  if (!income.ready || !fixed.ready) return "Nog onvoldoende gegevens";
  const free = income.total - fixed.total;
  if (free < 0) return "Je vaste lasten zijn hoger dan je inkomen";
  if (goalPayments.length === 0) return free === 0 ? "Inkomen en vaste lasten zijn in evenwicht" : "Geen doelen ingesteld";
  const margin = free - goalPayments.reduce((sum, amount) => sum + amount, 0);
  if (margin < 0) return "Onhoudbaar tempo";
  if (free === 0 || margin < 0.2 * free) return "Krap tempo";
  return "Stabiel tempo";
}

/** A row receipt does not assert that the entire list is complete. */
export function recordReview(item: {id:string; naam:string; bedrag:number; amountEntered?:boolean; reviewedInput?:string; monthlyVariable?:boolean; monthlyAmounts?:Record<string,number|null>}) {
  const {reviewedInput, ...fields} = item;
  const section = reviewSection("income", "Regel", manualReviewRows([fields]), {});
  const signature = JSON.stringify({...fields,...(fields.monthlyAmounts&&fields.monthlyVariable!==false?{effectiveMonth:currentCostMonth()}:{})});
  return {valid:section.valid, signature, ready:section.valid && reviewedInput === signature};
}

/** Share the same bank evidence check between Fundament, forecasts and AI readiness. */
export function reviewBankIncome(items: Parameters<typeof manualReviewRows>[0], transactions: unknown[], reviews: InputReviews, asOf: string): InputSection {
  const section = reviewSection("income", "Inkomen", manualReviewRows(items, asOf.slice(0,7)), reviews);
  const bankVerified = items.length > 0 && section.valid && items.every(item => {
    const evidence = (item as typeof item & {bankEvidence?: {transactionIds?: string[]; through?: string}}).bankEvidence;
    const date = evidence?.through;
    return Array.isArray(evidence?.transactionIds) && typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) && new Date(date).toISOString().slice(0,10) === date && date <= asOf &&
      transactions.some(raw => {
        if (!raw || typeof raw !== "object") return false;
        const t = raw as Record<string, unknown>;
        return evidence.transactionIds!.includes(String(t.id)) && t.provider === "lunchflow" && t.currency === "EUR" && t.date === date &&
          typeof t.amount === "number" && Number.isFinite(t.amount) && t.amount > 0 && Math.round(t.amount*100) === Math.round(item.bedrag*100) &&
          !["transfer", "financing", "ignore"].includes(String(t.bankPatternKind));
      });
  });
  return {...section, ready:section.ready || bankVerified, bankVerified};
}
