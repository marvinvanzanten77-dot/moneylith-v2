import type { SchuldItem } from "../components/SchuldenkaartCard";

export type StrategyKey = "snowball" | "balanced" | "avalanche" | "custom";

export type CustomPlan = {
  priorityOrder?: string[]; // ordered debt ids to target with extra budget
  extraPerDebt?: Record<string, number>; // optional custom per-debt override for minPayment
  monthlyBudgetOverride?: number;
  payFullInsteadOfRegeling?: boolean;
};

export type SimulatedDebt = {
  id: string;
  remaining: number;
  minPayment: number;
};

export type SimulationResult = {
  totalDebtStart: number;
  totalDebtRemaining: number;
  monthlyPressureNow: number;
  freeRoomNow: number;
  monthsToZero: number | null;
  pressureByMonth: number[];
  freeRoomByMonth: number[];
};

const MAX_MONTHS = 600;

const normalizeDebts = (debts: SchuldItem[], customPlan?: CustomPlan | null): SimulatedDebt[] =>
  debts
    .filter((d) => (d.saldo ?? 0) > 0)
    .map((d) => ({
      id: d.id,
      remaining: Math.max(0, d.saldo ?? 0),
      minPayment: customPlan?.extraPerDebt?.[d.id] ?? (typeof d.minimaleMaandlast === "number" && d.minimaleMaandlast > 0 ? d.minimaleMaandlast : 0),
    }));

const pickOrder = (items: SimulatedDebt[], strategy: StrategyKey): SimulatedDebt[] => {
  if (strategy === "snowball") {
    return [...items].sort((a, b) => a.remaining - b.remaining);
  }
  if (strategy === "avalanche") {
    return [...items].sort((a, b) => b.remaining - a.remaining);
  }
  // balanced: fallback to highest minPayment first, then largest remaining
  return [...items].sort((a, b) => {
    if (a.minPayment === b.minPayment) return b.remaining - a.remaining;
    return b.minPayment - a.minPayment;
  });
};

/**
 * Simulate month-by-month payoff with minima first, extra budget to a targeted debt.
 * - Payments are clamped by remaining balance (last term can be smaller).
 * - If monthlyBudget < sum(minima), minima are scaled proportionally.
 */
export function simulatePayoff(
  debts: SchuldItem[],
  monthlyBudget: number,
  strategy: StrategyKey,
  customPlan?: CustomPlan | null,
): SimulationResult {
  const normalized = normalizeDebts(debts, customPlan);
  const totalDebtStart = normalized.reduce((sum, d) => sum + d.remaining, 0);

  if (normalized.length === 0) {
    return {
      totalDebtStart,
      totalDebtRemaining: 0,
      monthlyPressureNow: 0,
      freeRoomNow: monthlyBudget,
      monthsToZero: 0,
      pressureByMonth: [],
      freeRoomByMonth: [],
    };
  }

  const debtsState = normalized.map((d) => ({ ...d }));
  const pressureByMonth: number[] = [];
  const freeRoomByMonth: number[] = [];

  const resolveTargetOrder = () => {
    if (customPlan?.priorityOrder?.length) {
      const byId = new Map(debtsState.map((d) => [d.id, d]));
      const ordered: SimulatedDebt[] = [];
      customPlan.priorityOrder.forEach((id) => {
        const found = byId.get(id);
        if (found && found.remaining > 0) ordered.push(found);
      });
      const rest = debtsState.filter((d) => d.remaining > 0 && !customPlan.priorityOrder?.includes(d.id));
      return [...ordered, ...rest];
    }
    return pickOrder(
      debtsState.filter((d) => d.remaining > 0),
      strategy,
    );
  };

  let months = 0;
  while (months < MAX_MONTHS && debtsState.some((d) => d.remaining > 0) && monthlyBudget > 0) {
    months += 1;
    let monthPressure = 0;

    const actives = debtsState.filter((d) => d.remaining > 0);
    const totalMin = actives.reduce((sum, d) => sum + Math.min(d.minPayment, d.remaining), 0);

    // Step 1: minima (scaled if budget insufficient)
    if (totalMin > 0) {
      const scale = monthlyBudget < totalMin ? monthlyBudget / totalMin : 1;
      actives.forEach((d) => {
        const planned = Math.min(d.minPayment, d.remaining);
        const pay = Math.min(d.remaining, planned * scale);
        d.remaining = Math.max(0, d.remaining - pay);
        monthPressure += pay;
      });
    }

    let budgetLeft = Math.max(0, monthlyBudget - monthPressure);

    // Step 2: extra budget to current target
    if (budgetLeft > 0) {
      const order = resolveTargetOrder();
      const target = order.find((d) => d.remaining > 0);
      if (target) {
        const pay = Math.min(target.remaining, budgetLeft);
        target.remaining -= pay;
        monthPressure += pay;
        budgetLeft = Math.max(0, budgetLeft - pay);
      }
    }

    pressureByMonth.push(monthPressure);
    freeRoomByMonth.push(Math.max(0, monthlyBudget - monthPressure));
  }

  const totalDebtRemaining = debtsState.reduce((sum, d) => sum + d.remaining, 0);
  const monthsToZero = totalDebtRemaining === 0 ? months : null;

  return {
    totalDebtStart,
    totalDebtRemaining,
    monthlyPressureNow: pressureByMonth[0] ?? 0,
    freeRoomNow: monthlyBudget - (pressureByMonth[0] ?? 0),
    monthsToZero,
    pressureByMonth,
    freeRoomByMonth,
  };
}

// Lightweight sanity checks for edge cases (dev only)
if (import.meta?.env?.DEV) {
  const debt = (remaining: number, min: number): SchuldItem => ({
    id: `${remaining}-${min}`,
    naam: "test",
    saldo: remaining,
    minimaleMaandlast: min,
  });
  const res1 = simulatePayoff([debt(47, 60)], 100, "snowball");
  console.assert(res1.monthsToZero === 1, "Remaining < maandlast should clear in 1 month");
  const res2 = simulatePayoff([debt(100, 0)], 50, "snowball");
  console.assert(res2.monthsToZero !== null, "Zero minPayment should still clear with extra budget");
}
