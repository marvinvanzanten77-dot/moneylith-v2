import type { IncomeItem, FixedCostManualItem } from "../types";

export type IncomeSuggestion = {
  amount: number;
  cadence: "monthly" | "weekly" | "yearly" | "unknown";
  label?: string;
  confidence: number;
};

export type FixedCostSuggestion = {
  name: string;
  amount: number;
  cadence: "monthly" | "weekly" | "yearly" | "unknown";
  confidence: number;
};

export type PrefillSuggestions = {
  incomeSuggestion?: IncomeSuggestion;
  fixedCostSuggestions: FixedCostSuggestion[];
};

const toNumber = (value: unknown): number | null => {
  const num = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  return Number.isFinite(num) ? num : null;
};

export function extractPrefillSuggestions(aiRaw: string | null | undefined): PrefillSuggestions {
  if (!aiRaw || typeof aiRaw !== "string") {
    return { fixedCostSuggestions: [] };
  }

  try {
    const parsed = JSON.parse(aiRaw);
    const income = parsed?.income ?? parsed?.suggestedIncome ?? parsed?.incomeSuggestion;
    const fixed = parsed?.fixedCosts ?? parsed?.fixedCostSuggestions ?? [];

    const incomeAmount = toNumber(income?.amount);
    const incomeSuggestion: IncomeSuggestion | undefined =
      incomeAmount != null
        ? {
            amount: incomeAmount,
            cadence: income?.cadence ?? income?.interval ?? "unknown",
            label: typeof income?.label === "string" ? income.label : undefined,
            confidence: typeof income?.confidence === "number" ? income.confidence : 0,
          }
        : undefined;

    const fixedCostSuggestions: FixedCostSuggestion[] = Array.isArray(fixed)
      ? fixed
          .map((item) => {
            const amt = toNumber(item?.amount);
            if (amt == null) return null;
            return {
              name: typeof item?.name === "string" ? item.name : typeof item?.label === "string" ? item.label : "AI-suggestie vaste last",
              amount: amt,
              cadence: item?.cadence ?? item?.interval ?? "unknown",
              confidence: typeof item?.confidence === "number" ? item.confidence : 0,
            } as FixedCostSuggestion;
          })
          .filter(Boolean) as FixedCostSuggestion[]
      : [];

    return {
      incomeSuggestion,
      fixedCostSuggestions,
    };
  } catch (e) {
    return { fixedCostSuggestions: [] };
  }
}

export function incomeSuggestionToItem(suggestion: IncomeSuggestion): IncomeItem {
  return {
    id: crypto.randomUUID(),
    naam: suggestion.label ?? "AI-inkomsten suggestie",
    bedrag: suggestion.amount,
    opmerking: `AI-suggestie (${suggestion.cadence})`,
  };
}

export function fixedSuggestionToItem(suggestion: FixedCostSuggestion): FixedCostManualItem {
  return {
    id: crypto.randomUUID(),
    naam: suggestion.name,
    bedrag: suggestion.amount,
    dagVanMaand: 1,
    opmerking: `AI-suggestie (${suggestion.cadence})`,
  };
}
