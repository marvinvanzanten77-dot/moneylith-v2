import {
  reviewSection,
  type InputSection,
  type ReviewRow,
} from "../logic/inputReadiness";
import {
  addMonth,
  cashSign,
  gross,
  monthEnd,
  sections,
  sectionLabels,
  vat,
  validateBusiness,
  type BusinessData,
  type Section,
} from "./model";

export function reviewSections(
  data: BusinessData,
): Record<Section, InputSection> {
  const end = monthEnd(data.month);
  const docRows = (sale: boolean): ReviewRow[] =>
    data.documents
      .filter(
        (d) =>
          (d.kind === "sale") === sale && d.date.slice(0, 7) === data.month,
      )
      .map((d) => ({ id: d.id, name: d.label, amount: d.net, details: d }));
  const planKeys = [
    "revenue",
    "costs",
    "salesVat",
    "costsVat",
    "draw",
  ] as const;
  const sources: Record<Section, ReviewRow[]> = {
    income: docRows(true),
    costs: docRows(false),
    cash: [
      ...data.accounts.map((a) => ({
        id: a.id,
        name: a.label,
        amount: Math.abs(a.opening),
        details: a,
      })),
      ...data.movements
        .filter((m) => m.date <= end)
        .map((m) => ({
          id: m.id,
          name: m.label,
          amount: m.amount,
          details: {
            movement: m,
            document: data.documents.find((d) => d.id === m.documentId),
          },
        })),
    ],
    debts: data.debts.map((d) => ({
      id: d.id,
      name: d.label,
      amount: d.opening,
      details: {
        debt: d,
        movements: data.movements.filter(
          (m) => m.debtId === d.id && m.date <= end,
        ),
      },
    })),
    assets: data.assets.map((a) => ({
      id: a.id,
      name: a.label,
      amount: a.value,
      details: a,
    })),
    plan: [
      ...planKeys.map((key) => ({
        id: key,
        name: key,
        amount: data.plan[key] ?? 0,
        complete: data.plan[key] !== null,
        details: { deductible: data.plan.deductible },
      })),
      ...data.debts.map((d) => ({
        id: d.id,
        name: d.label,
        amount: d.monthly ?? 0,
        complete: d.monthly !== null,
        details: d,
      })),
    ],
    reserves: ["taxPercent", "buffer"].map((key) => ({
      id: key,
      name: key,
      amount: data.plan[key as "taxPercent" | "buffer"] ?? 0,
      complete: data.plan[key as "taxPercent" | "buffer"] !== null,
    })),
  };
  return Object.fromEntries(
    sections.map((section) => {
      // Keep the existing exact-input receipt semantics, scoped to workspace, month and section.
      const rows = [
        {
          id: "scope",
          name: section,
          amount: 0,
          details: {
            section,
            month: data.month,
            workspace: data.workspace,
            ...(section === "cash"
              ? { documents: data.documents.filter((d) => d.date <= end) }
              : {}),
          },
        },
        ...sources[section],
      ];
      const result = reviewSection("income", sectionLabels[section], rows, {
        income: data.reviews[section],
      });
      return [section, { ...result, hasRows: sources[section].length > 0 }];
    }),
  ) as Record<Section, InputSection>;
}
export function changeBusiness(
  current: BusinessData,
  edit: (next: BusinessData) => void,
) {
  const next = structuredClone(current);
  edit(next);
  if (next.workspace !== current.workspace)
    throw new Error(
      "Een wijziging mag niet naar een andere administratie schrijven.",
    );
  validateBusiness(next);
  const checks = reviewSections(next);
  for (const key of sections)
    if (next.reviews[key] && !checks[key].ready) next.reviews[key] = null;
  return next;
}
export function confirmSection(
  data: BusinessData,
  section: Section,
  confirmed: boolean,
) {
  const result = reviewSections(data)[section];
  if (confirmed && !result.valid)
    throw new Error(
      "Vul de ontbrekende gegevens in; vul 0 in als het bedrag nul is.",
    );
  return changeBusiness(data, (next) => {
    next.reviews[section] = confirmed ? result.signature : null;
  });
}

export function calculateBusiness(data: BusinessData) {
  validateBusiness(data);
  const end = monthEnd(data.month);
  const docs = data.documents.filter((d) => d.date.slice(0, 7) === data.month);
  const movements = data.movements.filter((m) => m.date <= end);
  const currentMovements = movements.filter(
    (m) => m.date.slice(0, 7) === data.month,
  );
  const income = docs
    .filter((d) => d.kind === "sale")
    .reduce((sum, d) => sum + d.net, 0);
  const costs = docs
    .filter((d) => d.kind === "cost")
    .reduce(
      (sum, d) => sum + d.net + (d.deductible ? 0 : vat(d.net, d.vatRate)),
      0,
    );
  const outputVat = docs
    .filter((d) => d.kind === "sale")
    .reduce((sum, d) => sum + vat(d.net, d.vatRate), 0);
  const inputVat = docs
    .filter((d) => d.kind !== "sale" && d.deductible)
    .reduce((sum, d) => sum + vat(d.net, d.vatRate), 0);
  const profit = income - costs;
  const accounts = data.accounts.map((account) => ({
    ...account,
    balance:
      account.date > end
        ? null
        : account.opening +
          movements.reduce((sum, m) => {
            if (m.kind === "transfer")
              return (
                sum +
                (m.toAccountId === account.id ? m.amount : 0) -
                (m.accountId === account.id ? m.amount : 0)
              );
            return (
              sum +
              (m.accountId === account.id ? cashSign(m, data) * m.amount : 0)
            );
          }, 0),
  }));
  const cash = accounts.reduce((sum, a) => sum + (a.balance ?? 0), 0);
  const cashflow = currentMovements.reduce(
    (sum, m) =>
      sum + (m.kind === "transfer" ? 0 : cashSign(m, data) * m.amount),
    0,
  );
  const debts = data.debts.map((debt) => ({
    ...debt,
    balance:
      debt.date > end
        ? 0
        : debt.opening +
          movements
            .filter(
              (m) =>
                m.debtId === debt.id &&
                ["loan_in", "loan_out"].includes(m.kind),
            )
            .reduce(
              (sum, m) => sum + (m.kind === "loan_in" ? m.amount : -m.amount),
              0,
            ),
  }));
  const outstanding = data.documents
    .filter((d) => d.date <= end)
    .map((doc) => ({
      ...doc,
      unpaid:
        gross(doc) -
        movements
          .filter((m) => m.kind === "document" && m.documentId === doc.id)
          .reduce((sum, m) => sum + m.amount, 0),
    }));
  const receivables = outstanding
    .filter((d) => d.kind === "sale")
    .reduce((sum, d) => sum + d.unpaid, 0);
  const payables = outstanding
    .filter((d) => d.kind !== "sale")
    .reduce((sum, d) => sum + d.unpaid, 0);
  const vatPaid = currentMovements
    .filter((m) => m.kind === "vat_payment")
    .reduce((sum, m) => sum + m.amount, 0);
  const taxPaid = currentMovements
    .filter((m) => m.kind === "tax_payment")
    .reduce((sum, m) => sum + m.amount, 0);
  const vatReserve = Math.max(0, outputVat - inputVat - vatPaid);
  const taxReserve =
    data.plan.taxPercent === null
      ? null
      : Math.max(
          0,
          Math.round((Math.max(0, profit) * data.plan.taxPercent) / 100) -
            taxPaid,
        );
  const available =
    taxReserve === null || data.plan.buffer === null
      ? null
      : cash - vatReserve - taxReserve - data.plan.buffer - payables;
  return {
    income,
    costs,
    profit,
    outputVat,
    inputVat,
    vatReserve,
    taxReserve,
    available,
    cash,
    cashflow,
    accounts,
    debts,
    receivables,
    payables,
    outstanding,
    assetValue: data.assets.reduce((sum, a) => sum + a.value, 0),
    checks: reviewSections(data),
  };
}
export const requirements = {
  profit: ["income", "costs"],
  vat: ["income", "costs", "cash"],
  cash: ["cash"],
  available: ["income", "costs", "cash", "reserves"],
  forecast: ["income", "costs", "cash", "debts", "plan", "reserves"],
} satisfies Record<string, Section[]>;
export function missingFor(
  data: BusinessData,
  metric: keyof typeof requirements,
) {
  const checks = reviewSections(data);
  return requirements[metric]
    .filter((key) => !checks[key].ready)
    .map((key) => sectionLabels[key]);
}
export type Scenario = {
  revenueDelta: number;
  extraCost: number;
  oneOff: number;
};
export function forecastBusiness(
  data: BusinessData,
  scenario: Scenario = { revenueDelta: 0, extraCost: 0, oneOff: 0 },
) {
  if (missingFor(data, "forecast").length) return null;
  if (
    ![scenario.revenueDelta, scenario.extraCost, scenario.oneOff].every(
      (n) => Number.isSafeInteger(n) && Math.abs(n) <= 100_000_000_000,
    ) ||
    scenario.extraCost < 0 ||
    scenario.oneOff < 0
  )
    throw new Error("Vul geldige scenariobedragen in.");
  const now = calculateBusiness(data);
  const plan = data.plan;
  const revenue = Math.max(0, plan.revenue! + scenario.revenueDelta);
  const costs = plan.costs! + scenario.extraCost;
  const revenueVat = vat(revenue, plan.salesVat!);
  const costsVat = vat(costs, plan.costsVat!);
  const profit = revenue - costs - (plan.deductible ? 0 : costsVat);
  let bank = now.cash;
  let reserves = now.vatReserve + now.taxReserve!;
  const loans = now.debts.map((d) => ({
    balance: d.balance,
    monthly: d.monthly ?? 0,
  }));
  const result = [
    {
      month: data.month,
      bank,
      reserves,
      available: bank - reserves - plan.buffer! - now.payables,
      loanBalance: loans.reduce((sum, d) => sum + d.balance, 0),
    },
  ];
  for (let step = 1; step <= 12; step++) {
    const month = addMonth(data.month, step);
    let debtPayment = 0;
    for (const loan of loans) {
      const amount = Math.min(loan.balance, loan.monthly);
      loan.balance -= amount;
      debtPayment += amount;
    }
    // Only already-issued, unpaid documents: new plan turnover is a separate future period.
    const due = now.outstanding.filter(
      (d) =>
        d.unpaid > 0 &&
        (d.due.slice(0, 7) <= addMonth(data.month, 1)
          ? step === 1
          : d.due.slice(0, 7) === month),
    );
    const settlement = due.reduce(
      (sum, d) => sum + (d.kind === "sale" ? d.unpaid : -d.unpaid),
      0,
    );
    bank +=
      revenue +
      revenueVat -
      costs -
      costsVat -
      plan.draw! -
      debtPayment +
      settlement -
      (step === 1 ? scenario.oneOff : 0);
    reserves +=
      Math.max(0, revenueVat - (plan.deductible ? costsVat : 0)) +
      Math.round((Math.max(0, profit) * plan.taxPercent!) / 100);
    const remainingPayables = now.outstanding
      .filter((d) => d.kind !== "sale" && d.due.slice(0, 7) > month)
      .reduce((sum, d) => sum + d.unpaid, 0);
    result.push({
      month,
      bank,
      reserves,
      available: bank - reserves - plan.buffer! - remainingPayables,
      loanBalance: loans.reduce((sum, d) => sum + d.balance, 0),
    });
  }
  return result;
}
/** Readiness follows the same boundary if external AI is added later. Never turn unknown inputs into zero. */
export function businessAiContext(data: BusinessData) {
  const result = calculateBusiness(data);
  return {
    workspace: data.workspace,
    fictitious: data.workspace === "demo",
    month: data.month,
    missing: missingFor(data, "forecast"),
    income: result.checks.income.ready ? result.income : null,
    costs: result.checks.costs.ready ? result.costs : null,
    profit: missingFor(data, "profit").length ? null : result.profit,
    cash: missingFor(data, "cash").length ? null : result.cash,
    available: missingFor(data, "available").length ? null : result.available,
    scenario: data.scenario,
    forecast: forecastBusiness(data, data.scenario),
  };
}
