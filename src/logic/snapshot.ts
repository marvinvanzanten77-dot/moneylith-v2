export type SnapshotMode = "personal" | "business";

export interface CoreSnapshot {
  netIncome: number;
  fixedCosts: number;
  variableSpending: number;
  freeCash: number;
  fixedCostPressure: number;
  totalDebts: number;
  totalAssets: number;
  bufferMonths: number | null;
  goalsCount: number;
}

export interface SnapshotLegacyFields {
  nettoRuimte?: number;
  drukVasteLasten?: number;
  totaalSchuld?: number;
  totaalVermogen?: number;
  bufferMaanden?: number | null;
}

export type SnapshotV2 = CoreSnapshot & SnapshotLegacyFields;

export interface SnapshotInput {
  income?: any;
  fixedCosts?: any;
  cashflow?: any;
  debts?: any;
  assets?: any;
  goals?: any;
}

const clamp = (val: number, min: number, max: number) => Math.min(Math.max(val, min), max);

const safeSumIncome = (income: any): number => {
  if (!Array.isArray(income)) return 0;
  return income.reduce((sum, item) => {
    const v = typeof item?.bedrag === "number" ? item.bedrag : typeof item?.amount === "number" ? item.amount : 0;
    return sum + (v || 0);
  }, 0);
};

const safeSumFixedCosts = (fixedCosts: any): number => {
  if (!fixedCosts) return 0;
  // Support structure with manual items + fixedCostItems pattern from existing code
  if (Array.isArray(fixedCosts)) {
    return fixedCosts.reduce((sum, item) => {
      const v = typeof item?.bedrag === "number" ? item.bedrag : 0;
      return sum + (v || 0);
    }, 0);
  }
  const manualItems = Array.isArray(fixedCosts.manual) ? fixedCosts.manual : [];
  const autoItems = Array.isArray(fixedCosts.auto) ? fixedCosts.auto : [];
  const manualSum = manualItems.reduce((sum, item) => sum + (typeof item?.bedrag === "number" ? item.bedrag : 0), 0);
  const autoSum = autoItems.reduce((sum, item) => {
    const v = item?.customMonthlyAmount ?? item?.estimatedMonthlyAmount ?? 0;
    return sum + (typeof v === "number" ? v : 0);
  }, 0);
  return autoSum > 0 ? autoSum : manualSum;
};

const safeSumDebts = (debts: any): number => {
  if (!Array.isArray(debts)) return 0;
  return debts.reduce((sum, d) => sum + (typeof d?.saldo === "number" ? d.saldo : 0), 0);
};

const safeMinPayment = (debts: any): number => {
  if (!Array.isArray(debts)) return 0;
  return debts.reduce((sum, d) => sum + (typeof d?.minimaleMaandlast === "number" ? d.minimaleMaandlast : 0), 0);
};

const safeSumAssets = (assets: any): number => {
  if (!Array.isArray(assets)) return 0;
  return assets.reduce((sum, a) => sum + (typeof a?.bedrag === "number" ? a.bedrag : 0), 0);
};

const safeCountGoals = (goals: any): number => {
  if (!Array.isArray(goals)) return 0;
  return goals.length;
};

const safeVariableSpending = (cashflow: any): number => {
  if (!cashflow) return 0;
  if (typeof cashflow === "number") return cashflow;
  if (Array.isArray(cashflow)) return cashflow.reduce((sum, c) => sum + (typeof c?.amount === "number" ? c.amount : 0), 0);
  return 0;
};

export function buildSnapshotV2(input: SnapshotInput): SnapshotV2 {
  const incomeTotal = safeSumIncome(input.income);
  const fixedTotal = safeSumFixedCosts(input.fixedCosts);
  const debtsTotal = safeSumDebts(input.debts);
  const assetsTotal = safeSumAssets(input.assets);
  const goalsCount = safeCountGoals(input.goals);

  const freeCash = incomeTotal - fixedTotal;
  const fixedCostPressure = incomeTotal > 0 ? clamp(fixedTotal / incomeTotal, 0, 2) : 0;

  const bufferMonths = fixedTotal > 0 && assetsTotal > 0 ? assetsTotal / fixedTotal : null;

  const core: CoreSnapshot = {
    netIncome: incomeTotal,
    fixedCosts: fixedTotal,
    variableSpending: safeVariableSpending(input.cashflow),
    freeCash,
    fixedCostPressure,
    totalDebts: debtsTotal,
    totalAssets: assetsTotal,
    bufferMonths,
    goalsCount,
  };

  const legacy: SnapshotLegacyFields = {
    nettoRuimte: freeCash,
    drukVasteLasten: fixedCostPressure,
    totaalSchuld: debtsTotal,
    totaalVermogen: assetsTotal,
    bufferMaanden: bufferMonths,
  };

  return { ...core, ...legacy };
}
