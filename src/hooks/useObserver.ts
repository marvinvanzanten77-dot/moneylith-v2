import { useMemo } from "react";
import { useLocalStorage } from "./useLocalStorage";
import type {
  FinanceMode,
  FixedCostItem,
  FixedCostManualItem,
  IncomeItem,
  FutureIncomeItem,
  MoneylithAccount,
  AccountStatementMeta,
  MoneylithBucket,
  MoneylithGoal,
  MoneylithTransaction,
  SchuldItem,
} from "../types";
import { buildSnapshotV2, type SnapshotV2 } from "../logic/snapshot";

const sumAmounts = (
  items: { bedrag?: number; saldo?: number; minimaleMaandlast?: number; amount?: number }[],
  field: string,
) =>
  items.reduce((sum, item) => {
    const value = (item as any)[field];
    const num = typeof value === "number" ? value : 0;
    return sum + num;
  }, 0);

const useDomainData = (prefix: "personal" | "business") => {
  const incomeKey = prefix === "personal" ? "moneylith.personal.income" : "moneylith.business.income";
  const fixedManualKey = prefix === "personal" ? "moneylith.personal.fixedCosts" : "moneylith.business.fixedCosts";
  const fixedItemsKey = prefix === "personal" ? "fixed-cost-items" : "fixed-cost-items-business";
  const debtsKey = prefix === "personal" ? "moneylith.personal.debts" : "moneylith.business.debts";
  const assetsKey = prefix === "personal" ? "moneylith.personal.assets" : "moneylith.business.assets";
  const futureIncomeKey =
    prefix === "personal" ? "moneylith.personal.futureIncome" : "moneylith.business.futureIncome";
  const transactionsKey =
    prefix === "personal" ? "moneylith.personal.transactions" : "moneylith.business.transactions";
  const bucketsKey = prefix === "personal" ? "moneylith.personal.buckets" : "moneylith.business.buckets";
  const statementsKey =
    prefix === "personal" ? "moneylith.personal.statements" : "moneylith.business.statements";
  const accountsKey = prefix === "personal" ? "moneylith.personal.accounts" : "moneylith.business.accounts";
  const goalsKey = prefix === "personal" ? "moneylith.personal.goals" : "moneylith.business.goals";

  const [income] = useLocalStorage<IncomeItem[]>(incomeKey, []);
  const [fixedCostManualItems] = useLocalStorage<FixedCostManualItem[]>(fixedManualKey, []);
  const [fixedCostItems] = useLocalStorage<FixedCostItem[]>(fixedItemsKey, []);
  const [debts] = useLocalStorage<SchuldItem[]>(debtsKey, []);
  const [assets] = useLocalStorage<{ id: string; naam: string; bedrag: number }[]>(assetsKey, []);
  const [futureIncome] = useLocalStorage<FutureIncomeItem[]>(futureIncomeKey, []);
  const [transactions] = useLocalStorage<MoneylithTransaction[]>(transactionsKey, []);
  const [buckets] = useLocalStorage<MoneylithBucket[]>(bucketsKey, []);
  const [statements] = useLocalStorage<AccountStatementMeta[]>(statementsKey, []);
  const [accounts] = useLocalStorage<MoneylithAccount[]>(accountsKey, []);
  const [goals] = useLocalStorage<MoneylithGoal[]>(goalsKey, []);
  const [netIncome] = useLocalStorage<number>(
    prefix === "personal" ? "income-netto" : "income-netto-business",
    0,
  );
  const [manualFixedCosts] = useLocalStorage<number>(
    prefix === "personal" ? "fixed-costs" : "fixed-costs-business",
    0,
  );

  const incomeEnriched =
    income.length === 0 && netIncome > 0
      ? [{ id: "net-income-fallback", naam: "Netto inkomen", bedrag: netIncome } as IncomeItem]
      : income;
  const totalIncome = sumAmounts(incomeEnriched, "bedrag");
  const totalFixedManual = sumAmounts(fixedCostManualItems, "bedrag");
  const totalFixedAuto = fixedCostItems.reduce(
    (sum, item) => sum + (item.customMonthlyAmount ?? item.estimatedMonthlyAmount ?? 0),
    0,
  );
  const fixedCosts = totalFixedAuto > 0 ? totalFixedAuto : manualFixedCosts || totalFixedManual;
  const totalDebt = debts.reduce((sum, d) => sum + (d.saldo || 0), 0);
  const totalMinPayment = debts.reduce((sum, d) => sum + (d.minimaleMaandlast || 0), 0);
  const assetsTotal = assets.reduce((sum, a) => sum + (a.bedrag ?? 0), 0);
  const netFree = (netIncome || totalIncome) - fixedCosts;

  const snapshot: SnapshotV2 = buildSnapshotV2({
    income: incomeEnriched,
    fixedCosts: { manual: fixedCostManualItems, auto: fixedCostItems, manualSum: manualFixedCosts },
    debts,
    assets,
    goals,
  });

  const status = {
    fundamentFilled: income.length > 0 && fixedCostManualItems.length > 0,
    schuldenFilled: totalDebt > 0 && totalMinPayment > 0,
    vermogenFilled: assetsTotal > 0,
    rekeningenFilled: accounts.filter((a) => a.active && a.type === "betaalrekening").length > 0,
    afschriftenFilled: false,
    ritmeFilled: buckets.length > 0,
    doelenFilled: goals.length > 0,
  };

  status.afschriftenFilled = statements.some(
    (s) => status.rekeningenFilled && accounts.some((a) => a.id === s.accountId && a.active),
  );

  return {
    income: incomeEnriched,
    fixedCostManualItems,
    fixedCostItems,
    debts,
    assets,
    futureIncome,
    transactions,
    buckets,
    statements,
    accounts,
    goals,
    netIncome,
    manualFixedCosts,
    totals: {
      income: totalIncome,
      fixedCosts,
      debt: totalDebt,
      minPayment: totalMinPayment,
      assets: assetsTotal,
      netFree,
    },
    snapshot,
    status,
  };
};

export const useObserver = (mode: FinanceMode = "personal") => {
  const personal = useDomainData("personal");
  const business = useDomainData("business");

  return useMemo(
    () => ({
      mode,
      personal,
      business,
    }),
    [mode, personal, business],
  );
};

export interface ModeObservation {
  income: IncomeItem[];
  fixedCostManualItems: FixedCostManualItem[];
  fixedCostItems: FixedCostItem[];
  debts: SchuldItem[];
  assets: { id: string; naam: string; bedrag: number }[];
  transactions: MoneylithTransaction[];
  buckets: MoneylithBucket[];
  statements: AccountStatementMeta[];
  accounts: MoneylithAccount[];
  goals: MoneylithGoal[];
  netIncome: number;
  manualFixedCosts: number;
  totals: {
    income: number;
    fixedCosts: number;
    debt: number;
    minPayment: number;
    assets: number;
    netFree: number;
  };
  snapshot: SnapshotV2;
  status: {
    fundamentFilled: boolean;
    schuldenFilled: boolean;
    vermogenFilled: boolean;
    rekeningenFilled: boolean;
    afschriftenFilled: boolean;
    ritmeFilled: boolean;
    doelenFilled: boolean;
  };
}

export interface Observation {
  mode: FinanceMode;
  personal: ModeObservation;
  business: ModeObservation;
}
