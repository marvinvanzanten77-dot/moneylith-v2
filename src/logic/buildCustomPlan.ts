import type { CustomPlan } from "./debtSimulator";

type ParsedPlan = Partial<CustomPlan>;

const extractJson = (text: string): any | null => {
  try {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start >= 0 && end > start) {
      const slice = text.slice(start, end + 1);
      return JSON.parse(slice);
    }
  } catch {
    return null;
  }
  return null;
};

/**
 * Convert free-form AI text into a conservative CustomPlan.
 * Recognizes:
 *  - priority: [id|naam,...]
 *  - extra: {id|naam: amount}
 *  - budget: number
 */
export function buildCustomPlanFromAI(text: string, idByName: Record<string, string>): CustomPlan {
  const parsed = extractJson(text) ?? {};
  const plan: ParsedPlan = {};

  if (Array.isArray(parsed.priority)) {
    plan.priorityOrder = parsed.priority
      .map((entry: string) => entry?.toString?.().trim?.())
      .map((key: string) => idByName[key] ?? key)
      .filter(Boolean);
  }

  if (parsed.extra && typeof parsed.extra === "object") {
    const extra: Record<string, number> = {};
    Object.entries(parsed.extra).forEach(([k, v]) => {
      const num = typeof v === "number" ? v : parseFloat(String(v));
      if (!Number.isFinite(num)) return;
      const id = idByName[k] ?? k;
      extra[id] = Math.max(0, num);
    });
    if (Object.keys(extra).length) {
      plan.extraPerDebt = extra;
    }
  }

  if (parsed.budget && Number.isFinite(parsed.budget)) {
    plan.monthlyBudgetOverride = Math.max(0, parsed.budget);
  }

  // fallback: try simple lines "prioriteit: id1,id2" or "budget: 500"
  if (!plan.priorityOrder) {
    const match = text.match(/prioriteit[^:]*:\s*([^\n]+)/i);
    if (match?.[1]) {
      plan.priorityOrder = match[1]
        .split(",")
        .map((s) => s.trim())
        .map((k) => idByName[k] ?? k)
        .filter(Boolean);
    }
  }
  if (!plan.monthlyBudgetOverride) {
    const match = text.match(/budget[^:]*:\s*([0-9.,]+)/i);
    if (match?.[1]) {
      const num = parseFloat(match[1].replace(",", "."));
      if (Number.isFinite(num)) plan.monthlyBudgetOverride = Math.max(0, num);
    }
  }

  return {
    priorityOrder: plan.priorityOrder,
    extraPerDebt: plan.extraPerDebt,
    monthlyBudgetOverride: plan.monthlyBudgetOverride,
  };
}
