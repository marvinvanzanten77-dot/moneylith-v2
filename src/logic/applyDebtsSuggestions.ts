import type { AiActions } from "./extractActions";

type Mode = "personal" | "business";

type CanApplyResult = { ok: boolean; reason?: string; count?: number };

type DebtShape = { saldo?: number; minimaleMaandlast?: number };

function isEmptyDebts(currentDebts: DebtShape[]): boolean {
  if (!currentDebts || currentDebts.length === 0) return true;
  return !currentDebts.some((d) => {
    const amount = Number(d.saldo ?? d.minimaleMaandlast ?? 0);
    return Number.isFinite(amount) && amount > 0;
  });
}

export function canApplyDebtsSuggestions(args: {
  mode: Mode;
  actions: AiActions | null;
  currentDebts: DebtShape[];
}): CanApplyResult {
  const suggestions = (args.actions?.debts ?? []).filter((d) => (d?.confidence ?? 0) >= 0.6);
  if (suggestions.length === 0) {
    return { ok: false, reason: "Geen geldige schuld-suggesties" };
  }
  if (!isEmptyDebts(args.currentDebts)) {
    return { ok: false, reason: "Schuldenlijst is niet leeg" };
  }
  return { ok: true, count: suggestions.length };
}

export function buildDebtsPatchesFromActions(actions: AiActions): { id: string; naam: string; saldo: number; minimaleMaandlast?: number }[] {
  const filtered = (actions.debts ?? []).filter((d) => (d?.confidence ?? 0) >= 0.6);
  return filtered.map((d, index) => ({
    id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
    naam: d?.name?.trim() || "AI-suggestie schuld",
    saldo: Math.max(0, Number(d?.amount ?? 0)),
    minimaleMaandlast: undefined,
  }));
}
