import { useMemo, useState } from "react";

import { formatCurrency } from "../../utils/format";
import { projectGoal } from "../../logic/goals";
import type { FinancialSnapshot, MoneylithBucket, MoneylithGoal } from "../../types";
import type { AiActions } from "../../logic/extractActions";
import { buildGoalsPatchesFromActions, canApplyGoalsSuggestions } from "../../logic/applyGoalsSuggestions";

type StepFocusProps = {
  financialSnapshot?: FinancialSnapshot | null;
  goals?: MoneylithGoal[];
  onAddGoal?: (goal: Omit<MoneylithGoal, "id">) => void;
  onUpdateGoal?: (id: string, patch: Partial<MoneylithGoal>) => void;
  onDeleteGoal?: (id: string) => void;
  buckets?: MoneylithBucket[];
  variant?: "personal" | "business";
  readOnly?: boolean;
  mode?: "personal" | "business";
  actions?: AiActions | null;
};

export function StepFocus({
  financialSnapshot,
  goals = [],
  onAddGoal,
  onUpdateGoal,
  onDeleteGoal,
  buckets = [],
  variant = "personal",
  readOnly = false,
  mode = "personal",
  actions = null,
}: StepFocusProps) {
  const snapshot = financialSnapshot ?? null;
  const freePerMonth = snapshot ? snapshot.totalIncome.value - snapshot.fixedCostsTotal.value : 0;
  const isBusiness = variant === "business";
  const isReadOnly = readOnly === true;

  const [formState, setFormState] = useState<{
    id?: string;
    label: string;
    type: MoneylithGoal["type"];
    targetAmount: number;
    currentAmount: number;
    monthlyContribution: number;
    deadline?: string;
    linkedBucketIds: string[];
    isActive: boolean;
  }>(() => ({
    label: "",
    type: "savings",
    targetAmount: 0,
    currentAmount: 0,
    monthlyContribution: 0,
    deadline: "",
    linkedBucketIds: [],
    isActive: true,
  }));

  const activeGoals = goals.filter((g) => g.isActive);
  const projections = useMemo(() => new Map(activeGoals.map((g) => [g.id, projectGoal(g)])), [activeGoals]);
  const totalGoalPressure = Array.from(projections.values()).reduce((sum, p) => sum + p.pressurePerMonth, 0);
  const margin = freePerMonth - totalGoalPressure;
  const applyCheck = canApplyGoalsSuggestions({ mode, actions, currentGoals: goals });

  const resetForm = () => {
    setFormState({
      id: undefined,
      label: "",
      type: "savings",
      targetAmount: 0,
      currentAmount: 0,
      monthlyContribution: 0,
      deadline: "",
      linkedBucketIds: [],
      isActive: true,
    });
  };

  const handleEdit = (goal: MoneylithGoal) => {
    if (isReadOnly) return;
    setFormState({
      id: goal.id,
      label: goal.label,
      type: goal.type,
      targetAmount: goal.targetAmount,
      currentAmount: goal.currentAmount,
      monthlyContribution: goal.monthlyContribution,
      deadline: goal.deadline,
      linkedBucketIds: goal.linkedBucketIds ?? [],
      isActive: goal.isActive,
    });
  };

  const handleBucketToggle = (id: string) => {
    if (isReadOnly) return;
    setFormState((prev) => {
      const exists = prev.linkedBucketIds.includes(id);
      return {
        ...prev,
        linkedBucketIds: exists ? prev.linkedBucketIds.filter((b) => b !== id) : [...prev.linkedBucketIds, id],
      };
    });
  };

  const handleSubmit = () => {
    if (isReadOnly) return;
    if (!formState.label.trim()) return;
    let deadlineIso: string | undefined = undefined;
    if (deadlineInput.trim()) {
      const parsed = parseDateNlToIso(deadlineInput);
      if (!parsed) {
        setDeadlineValid(false);
        return;
      }
      deadlineIso = parsed;
      setDeadlineValid(true);
    }

    if (formState.isActive) {
      goals.forEach((g) => {
        if (g.id !== formState.id && g.isActive) {
          onUpdateGoal?.(g.id, { isActive: false });
        }
      });
    }

    if (formState.id) {
      onUpdateGoal?.(formState.id, {
        label: formState.label,
        type: formState.type,
        targetAmount: formState.targetAmount,
        currentAmount: formState.currentAmount,
        monthlyContribution: formState.monthlyContribution,
        deadline: deadlineIso ?? formState.deadline,
        linkedBucketIds: formState.linkedBucketIds,
        isActive: formState.isActive,
      });
    } else {
      onAddGoal?.({
        label: formState.label,
        type: formState.type,
        targetAmount: formState.targetAmount,
        currentAmount: formState.currentAmount,
        monthlyContribution: formState.monthlyContribution,
        deadline: deadlineIso ?? undefined,
        linkedBucketIds: formState.linkedBucketIds,
        isActive: formState.isActive,
      });
    }

    resetForm();
  };

  const handleDelete = (id: string) => {
    if (isReadOnly) return;
    if (confirm("Weet je zeker dat je dit doel wilt verwijderen?")) {
      onDeleteGoal?.(id);
      if (formState.id === id) resetForm();
    }
  };

  const handleApplyAiGoals = () => {
    if (isReadOnly || !applyCheck.ok || !actions) return;
    const patches = buildGoalsPatchesFromActions(actions);
    if (!patches.length) return;
    patches.forEach((patch) => onAddGoal?.(patch));
  };

  const marginLabel = () => {
    if (activeGoals.length === 0) return "Geen doelen ingesteld";
    if (freePerMonth <= 0) return "Onhoudbaar tempo";
    if (margin < 0) return "Onhoudbaar tempo";
    if (margin < 0.2 * freePerMonth) return "Krap tempo";
    return "Stabiel tempo";
  };

  return (
    <div className="space-y-6">
      <div className="mb-6 flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-slate-50">{isBusiness ? "Doelen (zakelijk)" : "Doelen"}</h1>
        <p className="text-sm text-slate-400">
          {activeGoals.length === 0 ? "Zonder doel is er geen brug tussen intentie en gedrag." : "Je focus brengt je intentie naar concreet geldgedrag."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2 space-y-4">
          {applyCheck.ok && !isReadOnly && (
            <div className="rounded-xl border border-amber-200/60 bg-amber-500/10 p-3 text-sm text-amber-50">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p>AI-suggesties voor doelen beschikbaar.</p>
                <button
                  type="button"
                  onClick={handleApplyAiGoals}
                  className="rounded-lg bg-amber-500 px-3 py-1 text-xs font-semibold text-slate-900 transition hover:bg-amber-400"
                >
                  Neem AI-suggesties over
                </button>
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-slate-50">{isBusiness ? "Een actief zakelijk doel" : "Een actief doel"}</h2>
                <p className="text-xs text-slate-400">
                  {isBusiness
                    ? "Je werkt altijd met een primair zakelijk focuspunt tegelijk."
                    : "Kies een doel als focus voor deze periode."}
                </p>
              </div>
              <span className="text-xs text-slate-400">{activeGoals.length} actief</span>
            </div>

            {goals.length === 0 && <p className="text-sm text-slate-300">Zonder doel ontbreekt richting.</p>}

            {goals.length > 0 && (
              <div className="space-y-3">
                {goals.map((goal) => {
                  const projection = projections.get(goal.id);
                  const progress = goal.targetAmount > 0 ? Math.min(goal.currentAmount / goal.targetAmount, 1) : 0;
                  return (
                    <div key={goal.id} className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 text-sm text-slate-200">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-50">{goal.label}</div>
                          <div className="text-[11px] text-slate-400">{goal.type}</div>
                        </div>
                        <div className="text-right text-xs text-slate-400">
                          <div>{Math.round(progress * 100)}%</div>
                          <div className="text-[11px]">{goal.isActive ? "Actief" : "Passief"}</div>
                        </div>
                      </div>

                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-300">
                        <div>
                          <div className="text-slate-400">Doelwaarde</div>
                          <div className="font-semibold text-slate-50">{formatCurrency(goal.targetAmount)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Huidige stand</div>
                          <div className="font-semibold text-slate-50">{formatCurrency(goal.currentAmount)}</div>
                        </div>
                        <div>
                          <div className="text-slate-400">Inleg p/m</div>
                          <div className="font-semibold text-slate-50">{formatCurrency(goal.monthlyContribution)}</div>
                        </div>
                        {goal.deadline && (
                          <div>
                            <div className="text-slate-400">Deadline</div>
                            <div className="font-semibold text-slate-50">{goal.deadline}</div>
                          </div>
                        )}
                      </div>

                      {projection && (
                        <div className="mt-2 text-[11px] text-slate-400">
                          <div>Resterend: {formatCurrency(projection.remaining)}</div>
                          <div>Tempo: {formatCurrency(projection.pressurePerMonth)} per maand</div>
                          <div>Bereikt in: {projection.monthsToTarget ?? "-"} maanden</div>
                        </div>
                      )}

                      {goal.linkedBucketIds && goal.linkedBucketIds.length > 0 && (
                        <div className="mt-2 text-[11px] text-slate-400">
                          Gekoppeld aan: {goal.linkedBucketIds.join(", ")}
                        </div>
                      )}

                      {!isReadOnly && (
                        <div className="mt-3 flex gap-2 text-xs">
                          <button
                            type="button"
                            className="rounded-md border border-slate-600 px-2 py-1 text-slate-200"
                            onClick={() => handleEdit(goal)}
                          >
                            Bewerken
                          </button>
                          <button
                            type="button"
                            className="rounded-md border border-red-400 px-2 py-1 text-red-200"
                            onClick={() => handleDelete(goal.id)}
                          >
                            Verwijderen
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4 rounded-2xl border border-slate-800 bg-slate-900/70 p-4 text-sm text-slate-200">
          <h3 className="text-lg font-semibold text-slate-50">{isBusiness ? "Zakelijk doel instellen" : "Actief doel instellen"}</h3>
          <div className="grid gap-3">
            <label className="text-xs text-slate-300">
              Doelnaam
              <input
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.label}
                onChange={(e) => setFormState((p) => ({ ...p, label: e.target.value }))}
                readOnly={isReadOnly}
              />
            </label>
            <label className="text-xs text-slate-300">
              Doeltype
              <select
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.type}
                onChange={(e) => setFormState((p) => ({ ...p, type: e.target.value as MoneylithGoal["type"] }))}
                disabled={isReadOnly}
              >
                <option value="savings">Sparen</option>
                <option value="debt_payoff">Schuld aflossen</option>
                <option value="buffer">Buffer opbouwen</option>
                <option value="project">Project / investering</option>
              </select>
            </label>
            <label className="text-xs text-slate-300">
              Doelwaarde
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.targetAmount}
                onChange={(e) => setFormState((p) => ({ ...p, targetAmount: Number(e.target.value) || 0 }))}
                readOnly={isReadOnly}
              />
            </label>
            <label className="text-xs text-slate-300">
              Huidige stand
              <input
                type="number"
                className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900/80 px-3 py-2 text-sm"
                value={formState.currentAmount}
                onChange={(e) => setFormState((p) => ({ ...p, currentAmount: Number(e.target.value) || 0 }))}
                readOnly={isReadOnly}
              />
            </label>
            <label className="text-xs text-slate-300">
              Deadline (optioneel, DD-MM-YYYY)
              <input
                type="text"
                inputMode="numeric"
                pattern="\\d{1,2}-\\d{1,2}-\\d{4}"
                className={`mt-1 w-full rounded-lg border bg-slate-900/80 px-3 py-2 text-sm ${
                  deadlineValid ? "border-slate-700" : "border-red-400"
                }`}
                value={deadlineInput}
                onChange={(e) => {
                  setDeadlineInput(e.target.value);
                  setDeadlineValid(!e.target.value || !!parseDateNlToIso(e.target.value));
                }}
                placeholder="bijv. 15-04-2026"
                disabled={isReadOnly}
              />
              {!deadlineValid && <p className="mt-1 text-[11px] text-red-300">Gebruik DD-MM-JJJJ, bijv. 15-04-2026.</p>}
            </label>
            <div className="flex items-center gap-2 text-xs text-slate-300">
              <input
                type="checkbox"
                checked={formState.isActive}
                onChange={(e) => setFormState((p) => ({ ...p, isActive: e.target.checked }))}
                disabled={isReadOnly}
              />
              <span>{isBusiness ? "Dit is het actieve hoofddoel" : "Actief doel"}</span>
            </div>

            <div className="text-xs text-slate-300">
              <p className="mb-1 text-slate-400">{isBusiness ? "Koppelen aan financiele stromen (optioneel):" : "Koppel aan potjes (optioneel):"}</p>
              <div className="grid max-h-32 grid-cols-1 gap-1 overflow-auto">
                {buckets.map((b) => (
                  <label key={b.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formState.linkedBucketIds.includes(b.id)}
                      onChange={() => handleBucketToggle(b.id)}
                      disabled={isReadOnly}
                    />
                    <span className="text-slate-200">
                      {b.label} ({b.type})
                    </span>
                  </label>
                ))}
                {buckets.length === 0 && <p className="text-[11px] text-slate-500">Nog geen financiele stromen beschikbaar.</p>}
              </div>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                className="rounded-lg bg-amber-500 px-3 py-2 text-sm font-semibold text-slate-900 hover:bg-amber-400"
                onClick={handleSubmit}
                disabled={isReadOnly}
              >
                {isBusiness ? "Zakelijk doel activeren" : formState.id ? "Doel bijwerken" : "Actief doel instellen"}
              </button>
              <button
                type="button"
                className="rounded-lg border border-slate-600 px-3 py-2 text-sm text-slate-200"
                onClick={resetForm}
                disabled={isReadOnly}
              >
                Formulier leegmaken
              </button>
              {formState.id && onDeleteGoal && (
                <button
                  type="button"
                  className="rounded-lg border border-red-400 px-3 py-2 text-sm text-red-200"
                  onClick={() => handleDelete(formState.id!)}
                  disabled={isReadOnly}
                >
                  Verwijder
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
