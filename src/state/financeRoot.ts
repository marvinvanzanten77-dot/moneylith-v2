import type {
  FinanceMode,
  FinanceRootState,
  FinanceDomainState,
  IncomeItem,
  FixedCostManualItem,
  FixedCostItem,
  SchuldItem,
  MoneylithTransaction,
  MoneylithBucket,
  AccountStatementMeta,
  MoneylithAccount,
  MoneylithGoal,
  FinancialSnapshot,
} from "../types";

const emptyDomainState: FinanceDomainState = {
  income: [] as IncomeItem[],
  fixedCostManualItems: [] as FixedCostManualItem[],
  fixedCostItems: [] as FixedCostItem[],
  debts: [] as SchuldItem[],
  assets: [], // AssetItem is lokaal in App.tsx; hier leeg
  goals: [] as MoneylithGoal[],
  transactions: [] as MoneylithTransaction[],
  buckets: [] as MoneylithBucket[],
  statements: [] as AccountStatementMeta[],
  accounts: [] as MoneylithAccount[],
  snapshot: null as FinancialSnapshot | null,
};

export const initialFinanceRootState: FinanceRootState = {
  personal: { ...emptyDomainState },
  business: { ...emptyDomainState },
};

export const getDomainState = (root: FinanceRootState, mode: FinanceMode): FinanceDomainState =>
  mode === "business" ? root.business : root.personal;

export const setDomainState = (
  root: FinanceRootState,
  mode: FinanceMode,
  updater: (current: FinanceDomainState) => FinanceDomainState,
): FinanceRootState => {
  if (mode === "business") {
    return { ...root, business: updater(root.business) };
  }
  return { ...root, personal: updater(root.personal) };
};
