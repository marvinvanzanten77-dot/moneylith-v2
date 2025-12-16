import type { AiActions } from "./extractActions";

type Mode = "personal" | "business";

type CanApplyResult = { ok: boolean; reason?: string; count?: number };

type GoalShape = { id?: string } & Record<string, unknown>;

function isEmptyGoals(currentGoals: GoalShape[]): boolean {
  if (!currentGoals || currentGoals.length === 0) return true;
  return false;
}

export function canApplyGoalsSuggestions(args: {
  mode: Mode;
  actions: AiActions | null;
  currentGoals: GoalShape[];
}): CanApplyResult {
  const suggestions = (args.actions?.goals ?? []).filter((g) => (g?.confidence ?? 0) >= 0.6);
  if (suggestions.length === 0) {
    return { ok: false, reason: "Geen geldige doel-suggesties" };
  }
  if (!isEmptyGoals(args.currentGoals)) {
    return { ok: false, reason: "Doelenlijst is niet leeg" };
  }
  return { ok: true, count: suggestions.length };
}

export function buildGoalsPatchesFromActions(actions: AiActions): Array<Omit<import("../types").MoneylithGoal, "id">> {
  const filtered = (actions.goals ?? []).filter((g) => (g?.confidence ?? 0) >= 0.6);
  return filtered.map((g, index) => ({
    label: g?.name?.trim() || "AI-suggestie doel",
    type: "savings",
    targetAmount: Math.max(0, Number(g?.target ?? 0)),
    currentAmount: 0,
    monthlyContribution: 0,
    deadline: g?.deadline || undefined,
    linkedBucketIds: [],
    isActive: index === 0,
  }));
}
