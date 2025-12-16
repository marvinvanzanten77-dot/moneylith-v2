import type { IncomeItem } from "../types";
import type { AiActions } from "./extractActions";

type Mode = "personal" | "business";

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now());
};

export function canApplyIncomeSuggestion({
  actions,
  currentIncome,
}: {
  mode: Mode;
  actions: AiActions | null;
  currentIncome: IncomeItem[];
}): { ok: boolean; reason?: string } {
  const hasIncome = Array.isArray(currentIncome) && currentIncome.some((item) => (item?.bedrag ?? 0) > 0);
  if (hasIncome) return { ok: false, reason: "Inkomen is al ingevuld" };

  const suggestion = actions?.income;
  if (!suggestion) return { ok: false, reason: "Geen AI-inkomensuggestie" };
  if ((suggestion.confidence ?? 0) < 0.6) return { ok: false, reason: "Te lage betrouwbaarheid" };

  return { ok: true };
}

export function buildIncomePatchFromActions(actions: AiActions): IncomeItem | null {
  const suggestion = actions?.income;
  if (!suggestion) return null;

  return {
    id: newId(),
    naam: suggestion.label?.trim() || "AI-inkomen",
    bedrag: Math.max(0, suggestion.amount || 0),
    opmerking: "AI-suggestie",
  };
}
