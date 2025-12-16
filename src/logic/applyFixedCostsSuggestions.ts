import type { FixedCostManualItem } from "../types";
import type { AiActions, AiCadence } from "./extractActions";

type Mode = "personal" | "business";

const newId = () => {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return String(Date.now());
};

const toDayOfMonth = (cadence?: AiCadence) => {
  // we hebben geen dag-informatie uit de AI; kies een veilige default
  return cadence === "weekly" ? 1 : 1;
};

export function canApplyFixedCostsSuggestions({
  actions,
  currentFixedCosts,
}: {
  mode: Mode;
  actions: AiActions | null;
  currentFixedCosts: FixedCostManualItem[];
}): { ok: boolean; reason?: string; count?: number } {
  const hasExisting = Array.isArray(currentFixedCosts) && currentFixedCosts.some((item) => (item?.bedrag ?? 0) > 0);
  if (hasExisting) return { ok: false, reason: "Vaste lasten al ingevuld" };

  const suggestions = (actions?.fixedCosts || []).filter((s) => (s.confidence ?? 0) >= 0.6);
  if (!suggestions.length) return { ok: false, reason: "Geen voldoende zekere suggesties" };

  return { ok: true, count: suggestions.length };
}

export function buildFixedCostsPatchesFromActions(actions: AiActions): FixedCostManualItem[] {
  const suggestions = (actions?.fixedCosts || []).filter((s) => (s.confidence ?? 0) >= 0.6);
  return suggestions.map((s) => ({
    id: newId(),
    naam: s.name?.trim() || "AI vaste last",
    bedrag: Math.max(0, s.amount || 0),
    dagVanMaand: toDayOfMonth(s.cadence),
    opmerking: "AI-suggestie",
  }));
}
